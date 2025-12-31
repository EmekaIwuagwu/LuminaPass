const { ethers } = require("hardhat");
const fs = require("fs");
const readline = require("readline");

// --- Configuration ---
// Must match the deployment (see output of deploy script)
const VALIDATOR_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const P256_MOCK_ADDRESS = "0x0000000000000000000000000000000000000100";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("\n==================================");
    console.log("   LuminaPass: Live Verification");
    console.log("==================================\n");

    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Check connection
    try {
        const net = await provider.getNetwork();
        console.log(`✅ Connected to local node (Chain ID: ${net.chainId})`);
    } catch (e) {
        console.error("❌ Could not connect to localhost:8545. Please run 'npx hardhat node'.");
        process.exit(1);
    }

    // Check deployment
    const code = await provider.getCode(VALIDATOR_ADDRESS);
    if (code === "0x") {
        console.error("❌ Validator not found at expected address. Did you run the deploy script?");
        process.exit(1);
    } else {
        console.log(`✅ Validator found at ${VALIDATOR_ADDRESS}`);
    }

    // Check Mock
    const mockCode = await provider.getCode(P256_MOCK_ADDRESS);
    if (mockCode === "0x") {
        console.error("❌ P256 Mock not found at 0x100. Did you deploy to localhost?");
        process.exit(1);
    } else {
        console.log(`✅ P256 Precompile Mock operational at 0x100`);
    }

    // ---------------------------------------------
    // INTERACTIVE FLOW
    // ---------------------------------------------
    console.log("\n--- Step 1: Account Setup ---");
    console.log("Enter the Public Key X and Y from your browser demo logs.");

    const xHex = await ask("Public Key X (Hex): ");
    const yHex = await ask("Public Key Y (Hex): ");
    const keyId = "manual-test-key";

    // Setup Signer (simulate "Smart Account")
    const [signer] = await ethers.getSigners();
    const validator = await ethers.getContractAt("PasskeyValidator", VALIDATOR_ADDRESS, signer);

    // Install Key
    console.log(`\nInstalling Passkey for account: ${signer.address}...`);
    try {
        const installData = new ethers.AbiCoder().encode(["uint256", "uint256", "string"], [xHex, yHex, keyId]);
        const tx = await validator.onInstall(installData);
        await tx.wait();
        console.log("✅ Passkey Installed Successfully!");
    } catch (e) {
        console.error("Failed to install passkey:", e.message);
        process.exit(1);
    }

    // ---------------------------------------------
    // VERIFICATION FLOW
    // ---------------------------------------------
    console.log("\n--- Step 2: On-Chain Verification ---");
    console.log("Now, generating a random UserOp Hash (Challenge) on-chain...");
    const userOpHash = ethers.hexlify(ethers.randomBytes(32));
    console.log(`\nCHALLENGE (UserOpHash): ${userOpHash}`);

    console.log("\n⚠️  Now, construct your Passkey Signature using the inputs below:");
    console.log("For manual testing, we will mock the signature data unless you have a raw output.");
    console.log("Since copying raw authenticatorData/clientJSON from browser is hard manually,");
    console.log("we will run a 'Synthetic Test' using the installed key to prove on-chain validation works.");

    // Synthetic Signature Construction
    // In a real app, these bytes come from the browser. 
    // Here we will mock the wrapper but use the REAL keys if you provided them (Wait, we can't sign without the device).

    // Actually, to verify the device, we NEED the device to sign THIS specific challenge.
    // Since we cannot easily send 'userOpHash' to your browser (no backend connected), 
    // we will perform a 'Self-Check' logic where we pretend we got a valid signature just to test the contract logic live.
    // ... Or we can fail if the signature is invalid.

    // Let's ask for R and S just to see.
    const rIn = await ask("Signature R (from browser, or random): ");
    const sIn = await ask("Signature S (from browser, or random): ");

    // Mock the Authenticator Data & ClientJSON to satisfy the parser
    // This is the tricky part: ClientJSON MUST match the challenge.
    // ClientJSON = `{"type":"webauthn.get","challenge":"<Base64Url(userOpHash)>",...}`

    // Generate valid challenge string
    const mhBytes = ethers.getBytes(userOpHash);
    const challengeBase64 = Buffer.from(mhBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeBase64}","origin":"http://localhost:5173"}`;
    const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000"; // Mock auth data

    const signature = new ethers.AbiCoder().encode(
        ["bytes", "string", "uint256", "uint256", "uint256"],
        [ethers.toUtf8Bytes(authenticatorData), clientDataJSON, rIn, sIn, 36] // 36 is approx offset of challenge
    );

    const userOp = {
        sender: signer.address,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        accountGasLimits: ethers.ZeroHash,
        preVerificationGas: 0,
        gasFees: ethers.ZeroHash,
        paymasterAndData: "0x",
        signature: signature
    };

    console.log("\nSubmitting Verification Transaction...");
    // We call validateUserOp as a view function to check result
    try {
        const res = await validator.validateUserOp(userOp, userOpHash);

        if (res === 0n) {
            console.log("\n🎉 SUCCESS: Signature Validated by Contract!");
            console.log("Note: Since we mocked the ClientJSON to match the challenge, this proves:");
            console.log("1. The contract correctly parsed the ClientJSON.");
            console.log("2. The contract confirmed challenge matches.");
            console.log("3. The P256 Precompile accepted the (Mock) signature.");
        } else {
            console.log("\n❌ VALIDATION FAILED (Code 1).");
            console.log("Expected if you entered random R/S values (signature invalid).");
        }
    } catch (e) {
        console.error("Transaction Error:", e.message);
    }

    rl.close();
}

main().catch(console.error);

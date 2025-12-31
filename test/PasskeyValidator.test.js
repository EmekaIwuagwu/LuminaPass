const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PasskeyValidator", function () {
    let validator;
    let owner;

    // Mock data for WebAuthn public key (P256)
    const pubKeyX = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
    const pubKeyY = 0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
    const keyId = "test-key-id";

    // Mock Precompile Address (RIP-7212)
    const P256_PRECOMPILE = "0x0000000000000000000000000000000000000100";

    before(async function () {
        [owner] = await ethers.getSigners();
        const PasskeyValidator = await ethers.getContractFactory("PasskeyValidator");
        validator = await PasskeyValidator.deploy();
        await validator.waitForDeployment();

        // ----------------------------------------------------
        // MOCK THE P256 PRECOMPILE
        // ----------------------------------------------------
        const MockP256 = await ethers.getContractFactory("MockP256Verifier");
        const mock = await MockP256.deploy();
        await mock.waitForDeployment();

        // Set the code of 0x100 to this mock
        const code = await ethers.provider.getCode(mock.target);
        await ethers.provider.send("hardhat_setCode", [
            P256_PRECOMPILE,
            code
        ]);
    });

    it("Should install a passkey correctly", async function () {
        const installData = new ethers.AbiCoder().encode(
            ["uint256", "uint256", "string"],
            [pubKeyX, pubKeyY, keyId]
        );

        await validator.connect(owner).onInstall(installData);

        const storedKey = await validator.smartAccountOwners(owner.address);
        expect(storedKey.pubKeyX).to.equal(pubKeyX);
        expect(storedKey.pubKeyY).to.equal(pubKeyY);
        expect(storedKey.keyId).to.equal(keyId);
    });

    it("Should validate a properly encoded signature with challenge check", async function () {
        // 1. Create Mock UserOp Hash
        const userOpHashHex = ethers.zeroPadValue(ethers.toBeHex(1234), 32);
        const userOpHashBytes = ethers.getBytes(userOpHashHex);

        // 2. Generate Base64Url Challenge (Node.js style)
        // We explicitly remove padding '=' to match Base64Url standard used in contract
        const challengeBase64 = Buffer.from(userOpHashBytes).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        // 3. Construct Client Data JSON containing this challenge
        const prefix = '{"type":"webauthn.get","challenge":"';
        const suffix = '","origin":"http://localhost:5173"}';
        const clientDataJSON = prefix + challengeBase64 + suffix;

        // Calculate the offset where the challenge starts
        // It starts after the prefix.
        const challengeOffset = prefix.length;

        // 4. Create Mock Signature Data
        const authData = ethers.toUtf8Bytes("mock-auth-data");
        const r = 1n;
        const s = 1n;

        const signature = new ethers.AbiCoder().encode(
            ["bytes", "string", "uint256", "uint256", "uint256"],
            [authData, clientDataJSON, r, s, challengeOffset]
        );

        // 5. UserOp structure
        const userOp = {
            sender: owner.address,
            nonce: 0,
            initCode: "0x",
            callData: "0x",
            accountGasLimits: ethers.ZeroHash,
            preVerificationGas: 0,
            gasFees: ethers.ZeroHash,
            paymasterAndData: "0x",
            signature: signature
        };

        // 6. Call validateUserOp
        // Should now pass because clientDataJSON actually contains the Base64Url(userOpHash) at challengeOffset
        const res = await validator.connect(owner).validateUserOp(userOp, userOpHashHex);

        expect(res).to.equal(0n);
    });
});

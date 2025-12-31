const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy the PasskeyValidator
    const PasskeyValidator = await hre.ethers.getContractFactory("PasskeyValidator");
    const validator = await PasskeyValidator.deploy();
    await validator.waitForDeployment();
    console.log(`✅ PasskeyValidator deployed to: ${validator.target}`);

    // 2. Setup P256 Mock (ONLY for Localhost/Hardhat)
    // Real networks (Base, Arbitrum) have this precompile built-in at 0x100.
    // Local Hardhat Node does NOT, so we must inject it magically.
    const network = await hre.ethers.provider.getNetwork();
    if (network.chainId === 31337n) {
        console.log("⚠️  Localhost detected! Injecting Mock P256 Verifier at 0x100...");

        const MockP256 = await hre.ethers.getContractFactory("MockP256Verifier");
        const mock = await MockP256.deploy();
        await mock.waitForDeployment();

        const code = await hre.ethers.provider.getCode(mock.target);

        // Hardhat RPC call to set code at a specific address
        await hre.ethers.provider.send("hardhat_setCode", [
            "0x0000000000000000000000000000000000000100",
            code
        ]);
        console.log("✅ Mock P256 Verifier injected at 0x100");
    }

    // 3. (Optional) Create a verification helper script hint
    console.log("\nDeployment Complete! You can now use the validator.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

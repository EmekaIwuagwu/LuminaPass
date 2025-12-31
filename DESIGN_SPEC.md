# LuminaPass: Decentralized Passkey Authentication for Smart Accounts
## Technical Design Specification v1.0

### 1. Executive Summary
LuminaPass aims to bridge the gap between web2 usability and web3 self-custody by implementing native Passkey (WebAuthn) support for ERC-4337 and ERC-7579 compatible smart accounts. Unlike custodial solutions or proprietary MPC networks, LuminaPass focuses on a purely on-chain, vendor-neutral verification mechanism using standard cryptographic primitives (Secp256r1).

This architecture allows users to "bring their own authenticator" (iCloud Keychain, Google Password Manager, YubiKey) and control a smart account directly, with zero reliance on centralized relayers or proprietary keys for the core authentication loop.

### 2. Architectural Principles

#### 2.1. Vendor Neutrality & Sovereignity
- **Non-Negotiable**: We will not rely on centralized MPC nodes or proprietary SaaS APIs for signing.
- **Direct Verification**: The smart account validates the WebAuthn signature directly on-chain (or using L2 precompiles like RIP-7212 where available).
- **Anti-Lockin**: The system is designed so that even if the LuminaPass interface disappears, the user's Passkey remains valid and can be used with any interface supporting the standard ABI.

#### 2.2. Modular Smart Accounts (ERC-7579)
We will adhere to the ERC-7579 Minimal Modular Smart Accounts standard. This ensures:
- **Interoperability**: Our passkey logic will be a standalone *Validator Module*.
- **Composability**: Users can attach this validator to any 7579-compliant account (Safe, Kernel, Biconomy, etc.).
- **Upgradability**: Users can rotate keys, add backup signers, or switch validation logic without migrating assets.

### 3. Core Components

#### 3.1. The On-Chain Validator (`PasskeyModule`)
This is the heart of the security model.
- **Function**: Verifies WebAuthn signatures (secp256r1) against the stored public key (x, y coordinates).
- **Optimization Strategy**: 
    - Use RIP-7212 (standard p256 precompile) on chains that support it (Base, Arbitrum soon, etc.) for gas efficiency.
    - Fallback to optimized Solidity implementations (like FCL or FreshCryptoLib) for chains without precompiles.
- **Data Structure**:
    ```solidity
    struct PasskeyCredential {
        uint256 pubKeyX;
        uint256 pubKeyY;
        string keyId;
    }
    ```

#### 3.2. The Client SDK (Library Layer)
A lightweight, open-source TypeScript library to handle the "Device <-> Chain" handshake.
- **Responsibilities**:
    - Triggering `navigator.credentials.create()` for account creation.
    - Triggering `navigator.credentials.get()` for transaction signing.
    - Formatting the WebAuthn `authenticatorData` and `clientDataJSON` into a compact ABI-encoded signature for the UserOp.
- **Philosophy**: Thin wrapper. No private servers.

#### 3.3. Recovery & Multi-Device Strategy
Passkeys are often synced (e.g., via iCloud), providing inherent redundancy. However, for true safety:
- We will support *Module-based* recovery features (e.g., adding a specific recovery address or a secondary passkey) via standard ERC-7579 config management.

### 4. Technical Stack & Dependencies

- **Blockchain Framework**: Hardhat (Chosen for Windows compatibility and ease of integration).
- **Cryptography**: 
  - `p256-verifier` (Solidity implementations of P256).
  - Browser-native WebAuthn APIs.
- **Account Standards**: 
  - `ERC-4337` (Account Abstraction).
  - `ERC-7579` (Modular Accounts).
- **Frontend/Integration**:
  - `viem` (for lightweight, type-safe Ethereum interactions).
  - Next.js (for the reference implementation/demo).

### 5. Implementation Roadmap

#### Phase 1: The Core Validator (Foundation)
- Implement `WebAuthnValidator.sol` adhering to ERC-7579 `IValidator`.
- Create a comprehensive test suite using stateless WebAuthn mock data.
- **Goal**: Verify a passkey signature on a local Anvil chain.

#### Phase 2: The Ejection-Proof Account (Integration)
- Build the Factory contract to deploy accounts with the Passkey Validator pre-installed.
- Develop the "Client Adapter" to translate browser Passkey outputs into Bundler-ready UserOps.
- **Goal**: End-to-end "one click" deployment of a smart account.

#### Phase 3: The Reference Client (UX)
- Build a beautiful, minimal demonstrator app.
- Show creation, funding, sending txs, and recovering accounts.

### 6. Out of Scope (Strictly)
- We will not build a hosted "Wallet-as-a-Service" backend.
- We will not build a new browser extension.
- We will not use email-magic-link MPC solutions.

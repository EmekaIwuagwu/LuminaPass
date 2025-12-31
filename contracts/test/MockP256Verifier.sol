// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract MockP256Verifier {
    fallback(bytes calldata) external returns (bytes memory) {
        // Return uint256(1) for success
        return abi.encode(uint256(1));
    }
}

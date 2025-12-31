// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IValidator {
    error InvalidTarget();

    /**
     * @dev Validates a UserOperation
     * @param userOp The UserOperation to be validated
     * @param userOpHash The hash of the UserOperation
     * @return validationData The validation data
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256 validationData);

    /**
     * @dev Validates a signature with a sender (ERC-1271 like)
     * @param sender The sender of the validation request
     * @param hash The hash to be validated
     * @param data The signature data
     * @return magicValue The magic value (0x1626ba7e) if valid
     */
    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata data
    ) external view returns (bytes4 magicValue);
}

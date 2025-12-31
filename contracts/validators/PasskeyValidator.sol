// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IERC7579Validator.sol";
import "../libraries/Base64Url.sol";

contract PasskeyValidator is IValidator {
    struct PasskeyPublicKey {
        uint256 pubKeyX;
        uint256 pub256Y;
        string keyId;
    }

    mapping(address => PasskeyPublicKey) public smartAccountOwners;
    address constant P256_VERIFIER = 0x0000000000000000000000000000000000000100;

    function onInstall(bytes calldata data) external {
        (uint256 x, uint256 y, string memory keyId) = abi.decode(
            data,
            (uint256, uint256, string)
        );
        smartAccountOwners[msg.sender] = PasskeyPublicKey(x, y, keyId);
    }

    function onUninstall(bytes calldata /* data */) external {
        delete smartAccountOwners[msg.sender];
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external view override returns (uint256 validationData) {
        return
            _validateSignature(msg.sender, userOpHash, userOp.signature)
                ? 0
                : 1;
    }

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata data
    ) external view override returns (bytes4 magicValue) {
        return
            _validateSignature(sender, hash, data)
                ? bytes4(0x1626ba7e)
                : bytes4(0xffffffff);
    }

    function _validateSignature(
        address account,
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        PasskeyPublicKey memory key = smartAccountOwners[account];
        if (key.pubKeyX == 0) return false;

        (
            bytes memory authenticatorData,
            string memory clientDataJSON,
            uint256 r,
            uint256 s,
            uint256 challengeOffset
        ) = abi.decode(signature, (bytes, string, uint256, uint256, uint256));

        if (!_verifyChallenge(clientDataJSON, hash, challengeOffset)) {
            return false;
        }

        bytes32 messageHash = sha256(
            abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON)))
        );

        return
            _verifyP256Signature(messageHash, r, s, key.pubKeyX, key.pub256Y);
    }

    function _verifyChallenge(
        string memory clientDataJSON,
        bytes32 userOpHash,
        uint256 offset
    ) internal view returns (bool) {
        string memory expectedChallenge = Base64Url.encode(
            abi.encodePacked(userOpHash)
        );
        bytes memory expectedBytes = bytes(expectedChallenge);
        bytes memory jsonBytes = bytes(clientDataJSON);

        if (offset + expectedBytes.length > jsonBytes.length) {
            return false;
        }

        for (uint256 i = 0; i < expectedBytes.length; i++) {
            if (jsonBytes[offset + i] != expectedBytes[i]) {
                return false;
            }
        }
        return true;
    }

    function _verifyP256Signature(
        bytes32 hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        bytes memory input = abi.encode(hash, r, s, x, y);
        (bool success, bytes memory ret) = P256_VERIFIER.staticcall(input);
        if (!success || ret.length == 0) return false;
        return abi.decode(ret, (uint256)) == 1;
    }
}

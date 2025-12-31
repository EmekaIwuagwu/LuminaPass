// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

library Base64Url {
    string internal constant TABLE =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        string memory table = TABLE;
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        string memory result = new string(encodedLen + 32);

        assembly {
            mstore(result, encodedLen)
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            let dataPtr := add(data, 32)
            let len := mload(data)

            for {
                let i := 0
            } lt(i, len) {
                i := add(i, 3)
            } {
                let input := 0

                // Read 3 bytes safely
                input := shl(16, byte(0, mload(add(dataPtr, i))))

                if lt(add(i, 1), len) {
                    input := or(
                        input,
                        shl(8, byte(0, mload(add(dataPtr, add(i, 1)))))
                    )
                }

                if lt(add(i, 2), len) {
                    input := or(input, byte(0, mload(add(dataPtr, add(i, 2)))))
                }

                // transform 24-bit input into 4 chars
                mstore8(
                    resultPtr,
                    mload(add(tablePtr, and(shr(18, input), 0x3F)))
                )
                resultPtr := add(resultPtr, 1)

                mstore8(
                    resultPtr,
                    mload(add(tablePtr, and(shr(12, input), 0x3F)))
                )
                resultPtr := add(resultPtr, 1)

                mstore8(
                    resultPtr,
                    mload(add(tablePtr, and(shr(6, input), 0x3F)))
                )
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }

            // Adjust actual length and truncate padding
            let rem := mod(len, 3)
            switch rem
            case 1 {
                encodedLen := sub(encodedLen, 2)
            }
            case 2 {
                encodedLen := sub(encodedLen, 1)
            }
            mstore(result, encodedLen)
        }

        return result;
    }
}

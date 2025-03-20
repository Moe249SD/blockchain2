// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentStorage {
    mapping(bytes32 => bool) private storedHashes;

    // تخزين التجزئة في البلوكشين
    function storeDocument(bytes32 hash) public {
        storedHashes[hash] = true;
    }

    // التحقق مما إذا كان التجزئة مخزنًا مسبقًا
    function verifyDocument(bytes32 hash) public view returns (bool) {
        return storedHashes[hash];
    }
}

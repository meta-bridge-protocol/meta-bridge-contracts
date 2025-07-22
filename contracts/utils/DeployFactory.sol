// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library DeployFactory {
    function deployContract(
        bytes memory bytecode,
        uint salt
    ) internal returns (address) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }
}

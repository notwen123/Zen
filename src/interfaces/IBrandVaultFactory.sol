// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IBrandVaultFactory {
    function vaultOf(bytes32 brandId) external view returns (address);
}

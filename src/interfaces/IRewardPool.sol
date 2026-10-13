// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRewardPool {
    function budgetOf(bytes32 brandId) external view returns (uint256);
    function fund(bytes32 brandId, uint256 amount) external;
    function allocate(bytes32 brandId, address to, uint256 amount) external returns (uint256 shares);
}

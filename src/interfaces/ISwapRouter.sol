// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Uniswap SwapRouter02 `exactInputSingle` (no `deadline` field).
/// @dev Adapted from Wield's ISwapRouter, which used the original V3 SwapRouter struct
///      (with `deadline`, selector 0x414bf389). SwapRouter02 deployments only expose
///      selector 0x04e45aaf, so every swap through the old layout would revert.
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

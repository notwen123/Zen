// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Uniswap SwapRouter02 `exactInputSingle` (no `deadline` field).
/// @dev Adapted from Wield's ISwapRouter, which used the original V3 SwapRouter struct
///      (with `deadline`, selector 0x414bf389). The router Wield configured on Robinhood
///      Chain mainnet (0xCaf681a66D020601342297493863E78C959E5cb2) only exposes the
///      SwapRouter02 selector 0x04e45aaf (verified against deployed bytecode, 2026-09-28).
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

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";

/// @notice TEST/DEMO ONLY SwapRouter02 stand-in. Pays tokenOut from pre-funded inventory at
///         a hand-set rate (tokenOut per 1e18 tokenIn). Refuses production chains.
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public rate;

    error ProductionChain();

    constructor() {
        if (block.chainid == 4663 || block.chainid == 42161) revert ProductionChain();
    }

    function setRate(address tokenIn, address tokenOut, uint256 r) external {
        rate[tokenIn][tokenOut] = r;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 amountOut) {
        amountOut = (p.amountIn * rate[p.tokenIn][p.tokenOut]) / 1e18;
        require(amountOut >= p.amountOutMinimum, "MockRouter: slippage");
        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);
        IERC20(p.tokenOut).safeTransfer(p.recipient, amountOut);
    }
}

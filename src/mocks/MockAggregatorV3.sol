// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

/// @notice TEST/DEMO ONLY price feed (adapted from Wield). Prices are set by hand and are
///         not market data. Refuses production chains.
contract MockAggregatorV3 is IAggregatorV3 {
    uint8 private immutable _decimals;
    int256 private _answer;
    uint256 private _updatedAt;

    error ProductionChain();

    constructor(uint8 decimals_, int256 answer_) {
        if (block.chainid == 4663 || block.chainid == 42161) revert ProductionChain();
        _decimals = decimals_;
        _answer = answer_;
        _updatedAt = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function setAnswer(int256 answer_) external {
        _answer = answer_;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 t) external {
        _updatedAt = t;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }
}

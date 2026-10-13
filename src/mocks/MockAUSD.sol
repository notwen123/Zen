// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST/DEMO ONLY. 6-decimal stand-in for Agora AUSD, the dollar stablecoin used on Monad
///         (adapted from Wield's stablecoin mock). Refuses production chains (Monad mainnet, Ethereum).
contract MockAUSD is ERC20 {
    error ProductionChain();

    constructor() ERC20("Mock AUSD (TEST)", "mAUSD") {
        if (block.chainid == 143 || block.chainid == 1) revert ProductionChain();
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

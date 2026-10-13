// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST/DEMO ONLY. 6-decimal stand-in for Paxos USDG (adapted from Wield). Refuses production chains.
contract MockUSDG is ERC20 {
    error ProductionChain();

    constructor() ERC20("Mock USDG (TEST)", "mUSDG") {
        if (block.chainid == 4663 || block.chainid == 42161) revert ProductionChain();
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

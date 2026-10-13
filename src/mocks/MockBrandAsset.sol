// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice TEST/DEMO ONLY. A fictional stand-in for brand exposure, e.g.
///         "Mock Nike Exposure (TEST)" / "mNKE". It is NOT a security, NOT issued by or
///         affiliated with the brand or Robinhood, and has no redemption value.
/// @dev Refuses to deploy on Robinhood Chain mainnet (4663) or Arbitrum One (42161).
contract MockBrandAsset is ERC20, Ownable {
    error ProductionChain();

    constructor(string memory name_, string memory symbol_, address owner_) ERC20(name_, symbol_) Ownable(owner_) {
        if (block.chainid == 4663 || block.chainid == 42161) revert ProductionChain();
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

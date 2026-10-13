// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BrandVault
/// @notice Pooled exposure to one brand asset. Rewards arrive as deposits made on the
///         user's behalf, so users hold vault shares instead of raw-token dust.
/// @dev Deliberately admin-less: no owner, no pause, no sweep. Nobody but a share holder
///      can move assets out. `_decimalsOffset = 6` makes first-depositor inflation
///      attacks unprofitable (OZ v5 virtual shares).
contract BrandVault is ERC4626 {
    bytes32 public immutable brandId;

    constructor(IERC20 asset_, bytes32 brandId_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        brandId = brandId_;
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}

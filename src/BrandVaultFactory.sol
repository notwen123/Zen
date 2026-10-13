// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BrandVault} from "./BrandVault.sol";
import {IBrandVaultFactory} from "./interfaces/IBrandVaultFactory.sol";

/// @title BrandVaultFactory
/// @notice One BrandVault per brand. CREATE2 salted by brandId, so a brand's vault
///         address is deterministic and can never be created twice.
contract BrandVaultFactory is IBrandVaultFactory, Ownable {
    mapping(bytes32 => address) public vaultOf;
    bytes32[] public brandIds;

    error VaultExists(bytes32 brandId);
    error BadBrand();

    event BrandVaultCreated(bytes32 indexed brandId, address indexed vault, address indexed asset);

    constructor(address owner_) Ownable(owner_) {}

    function createVault(bytes32 brandId, IERC20 asset, string calldata name, string calldata symbol)
        external
        onlyOwner
        returns (address vault)
    {
        if (brandId == 0 || address(asset) == address(0)) revert BadBrand();
        if (vaultOf[brandId] != address(0)) revert VaultExists(brandId);
        vault = address(new BrandVault{salt: brandId}(asset, brandId, name, symbol));
        vaultOf[brandId] = vault;
        brandIds.push(brandId);
        emit BrandVaultCreated(brandId, vault, address(asset));
    }

    function brandCount() external view returns (uint256) {
        return brandIds.length;
    }
}

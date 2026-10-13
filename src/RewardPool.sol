// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBrandVaultFactory} from "./interfaces/IBrandVaultFactory.sol";
import {IRewardPool} from "./interfaces/IRewardPool.sol";

/// @title RewardPool
/// @notice Sponsor-funded reward budget, held per brand as brand-asset inventory.
///         `allocate` (registry only) deposits budget into the brand vault for the user.
///         Rewards can never exceed what sponsors deposited: there is no minting path.
/// @dev Budget is tracked in storage, not via balanceOf, so donations cannot inflate it.
contract RewardPool is IRewardPool, Ownable {
    using SafeERC20 for IERC20;

    IBrandVaultFactory public immutable factory;
    address public registry;
    mapping(bytes32 => uint256) public budgetOf;

    error NotRegistry();
    error NoVault(bytes32 brandId);
    error InsufficientBudget();
    error ZeroAmount();
    error ZeroAddress();

    event RegistrySet(address indexed registry);
    event BudgetFunded(bytes32 indexed brandId, address indexed sponsor, uint256 amount);
    event BudgetWithdrawn(bytes32 indexed brandId, address indexed to, uint256 amount);
    event BudgetAllocated(bytes32 indexed brandId, address indexed to, uint256 assets, uint256 shares);

    constructor(address owner_, IBrandVaultFactory factory_) Ownable(owner_) {
        if (address(factory_) == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function setRegistry(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        registry = r;
        emit RegistrySet(r);
    }

    /// @notice Anyone (merchant / sponsor) can add budget in the brand's vault asset.
    function fund(bytes32 brandId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        IERC20 asset = IERC20(IERC4626(_vault(brandId)).asset());
        budgetOf[brandId] += amount;
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit BudgetFunded(brandId, msg.sender, amount);
    }

    /// @notice Return unallocated budget (sponsor exit / emergency). Never touches vaults
    ///         or already-allocated user shares. Works regardless of registry pause.
    function withdrawBudget(bytes32 brandId, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > budgetOf[brandId]) revert InsufficientBudget();
        budgetOf[brandId] -= amount;
        IERC20(IERC4626(_vault(brandId)).asset()).safeTransfer(to, amount);
        emit BudgetWithdrawn(brandId, to, amount);
    }

    function allocate(bytes32 brandId, address to, uint256 amount) external returns (uint256 shares) {
        if (msg.sender != registry) revert NotRegistry();
        if (amount == 0) revert ZeroAmount();
        if (amount > budgetOf[brandId]) revert InsufficientBudget();
        budgetOf[brandId] -= amount;
        IERC4626 vault = IERC4626(_vault(brandId));
        IERC20(vault.asset()).forceApprove(address(vault), amount);
        shares = vault.deposit(amount, to);
        emit BudgetAllocated(brandId, to, amount, shares);
    }

    function _vault(bytes32 brandId) internal view returns (address v) {
        v = factory.vaultOf(brandId);
        if (v == address(0)) revert NoVault(brandId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBrandVaultFactory} from "./interfaces/IBrandVaultFactory.sol";
import {IRewardPool} from "./interfaces/IRewardPool.sol";
import {IConditionalClaim} from "./interfaces/IConditionalClaim.sol";

/// @title RewardPool
/// @notice Sponsor-funded reward budget, held per brand as brand-asset (tokenized equity) inventory.
///         `allocate` (registry only) moves the reward into escrow and mints a ConditionalClaim:
///         the equity stays locked until the purchase's return window closes. A voided claim's
///         escrow comes back here via `creditBudget`. Settled equity can be deposited into the
///         brand's admin-less BrandVault by its holder. There is no minting path for equity.
/// @dev Budget is tracked in storage, not via balanceOf, so donations cannot inflate it.
contract RewardPool is IRewardPool, Ownable {
    using SafeERC20 for IERC20;

    IBrandVaultFactory public immutable factory;
    address public registry;
    IConditionalClaim public conditional;
    mapping(bytes32 => uint256) public budgetOf;

    error NotRegistry();
    error NotConditional();
    error AlreadySet();
    error NoVault(bytes32 brandId);
    error InsufficientBudget();
    error ZeroAmount();
    error ZeroAddress();

    event RegistrySet(address indexed registry);
    event BudgetFunded(bytes32 indexed brandId, address indexed sponsor, uint256 amount);
    event BudgetWithdrawn(bytes32 indexed brandId, address indexed to, uint256 amount);
    event BudgetAllocated(bytes32 indexed brandId, address indexed to, uint256 assets, uint256 claimId);
    event BudgetCredited(bytes32 indexed brandId, uint256 amount);
    event ConditionalSet(address indexed conditional);

    constructor(address owner_, IBrandVaultFactory factory_) Ownable(owner_) {
        if (address(factory_) == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function setRegistry(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        registry = r;
        emit RegistrySet(r);
    }

    /// @notice One-time wiring of the ConditionalClaim contract.
    function setConditional(IConditionalClaim c) external onlyOwner {
        if (address(c) == address(0)) revert ZeroAddress();
        if (address(conditional) != address(0)) revert AlreadySet();
        conditional = c;
        emit ConditionalSet(address(c));
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

    /// @notice Registry only: escrow `amount` and mint a conditional claim that unlocks after the
    ///         purchase's return window.
    function allocate(bytes32 brandId, address to, uint256 amount, uint64 purchasedAt)
        external
        returns (uint256 claimId)
    {
        if (msg.sender != registry) revert NotRegistry();
        if (amount == 0) revert ZeroAmount();
        if (amount > budgetOf[brandId]) revert InsufficientBudget();
        budgetOf[brandId] -= amount;
        address asset = IERC4626(_vault(brandId)).asset();
        IERC20(asset).safeTransfer(address(conditional), amount);
        claimId = conditional.mint(to, brandId, asset, amount, purchasedAt);
        emit BudgetAllocated(brandId, to, amount, claimId);
    }

    /// @notice ConditionalClaim only: a voided claim's escrow (already transferred here) rejoins the budget.
    function creditBudget(bytes32 brandId, uint256 amount) external {
        if (msg.sender != address(conditional)) revert NotConditional();
        budgetOf[brandId] += amount;
        emit BudgetCredited(brandId, amount);
    }

    function _vault(bytes32 brandId) internal view returns (address v) {
        v = factory.vaultOf(brandId);
        if (v == address(0)) revert NoVault(brandId);
    }
}

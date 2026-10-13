// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IConditionalClaim, IClaimHolder} from "./interfaces/IConditionalClaim.sol";

/// @title InstantExitPool
/// @notice The market for consumer refund risk. One pool per equity token. LPs deposit the equity
///         token; a shopper holding a Locked claim can sell it here immediately at a discount that
///         prices (a) the chance the purchase is refunded, (b) time to unlock, (c) an LP fee.
///         If the claim settles the pool earns `amount - price`; if it is voided the pool loses `price`.
///
///   price = amount * (1 - pRefund[cat] * walletRiskMult(claimant))
///                  * (1 - timeValueBps * secondsToUnlock / YEAR)
///                  * (1 - lpFeeBps)                                   (all factors in bps)
///
///   walletRiskMult = 1 + riskSlopeBps * voids / claims  (the wallet's onchain void ratio), capped.
///
/// @dev Accounting: totalAssets = idle balance + book cost of claims still held. Gains are recognized
///      at settle, losses at void, through ConditionalClaim's callback (or `reconcile`, which anyone can
///      call if a callback ever failed). Withdrawals are limited to idle assets: capital locked in
///      claims waits for resolution. `_decimalsOffset = 6` blunts first-depositor inflation.
///      Category and pricing parameters are set by `owner`, a DEMO ADMIN; in production this would be
///      a timelock/governance, and the parameters are bounded on-chain either way.
contract InstantExitPool is ERC4626, IClaimHolder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;
    uint16 public constant MAX_P_REFUND_BPS = 9_000;
    uint16 public constant MAX_TIME_VALUE_BPS = 5_000;
    uint16 public constant MAX_LP_FEE_BPS = 1_000;
    uint16 public constant MAX_RISK_SLOPE_BPS = 20_000;
    uint256 public constant MAX_RISK_MULT_BPS = 30_000; // a wallet can at most triple its category risk
    uint64 public constant MAX_MIN_HOLD = 30 days;

    struct CategoryParams {
        uint16 pRefundBps; // probability the purchase is refunded, in bps
        uint64 minHoldSeconds; // a claim can be sold only this long after minting (adverse selection)
        bool enabled;
    }

    IConditionalClaim public immutable claims;
    mapping(uint8 => CategoryParams) public categoryParams;
    uint16 public timeValueBps; // annualized discount for waiting until unlock
    uint16 public lpFeeBps;
    uint16 public riskSlopeBps; // how fast wallet risk rises with its void ratio

    mapping(uint256 => uint256) public bookCost; // claimId => price paid (0 = not held / resolved)
    uint256 public totalBooked;
    uint256 public heldCount;
    uint256 public realizedGains;
    uint256 public realizedLosses;
    uint256 public claimsBought;

    error ZeroAddress();
    error BadParams();
    error WrongAsset();
    error NotForSale(uint256 id);
    error CategoryDisabled(uint8 category);
    error MinHold(uint256 id, uint256 sellableAt);
    error Slippage(uint256 price, uint256 minOut);
    error InsufficientLiquidity(uint256 price, uint256 idle);
    error NotClaims();
    error NotHolder();

    event CategoryParamsSet(uint8 indexed category, CategoryParams params);
    event PricingSet(uint16 timeValueBps, uint16 lpFeeBps, uint16 riskSlopeBps);
    event ClaimBought(uint256 indexed id, address indexed seller, uint256 amount, uint256 price);
    event ClaimResolved(uint256 indexed id, bool settled, uint256 cost, uint256 proceeds);

    constructor(
        address owner_,
        IConditionalClaim claims_,
        IERC20 equity_,
        string memory name_,
        string memory symbol_,
        uint16 timeValueBps_,
        uint16 lpFeeBps_,
        uint16 riskSlopeBps_
    ) ERC20(name_, symbol_) ERC4626(equity_) Ownable(owner_) {
        if (address(claims_) == address(0) || address(equity_) == address(0)) revert ZeroAddress();
        claims = claims_;
        _setPricing(timeValueBps_, lpFeeBps_, riskSlopeBps_);
    }

    // ---------------------------------------------------------------- demo admin (bounded)

    function setCategoryParams(uint8 category, CategoryParams calldata p) external onlyOwner {
        if (category == 0 || p.pRefundBps > MAX_P_REFUND_BPS || p.minHoldSeconds > MAX_MIN_HOLD) revert BadParams();
        categoryParams[category] = p;
        emit CategoryParamsSet(category, p);
    }

    function setPricing(uint16 timeValueBps_, uint16 lpFeeBps_, uint16 riskSlopeBps_) external onlyOwner {
        _setPricing(timeValueBps_, lpFeeBps_, riskSlopeBps_);
    }

    // ---------------------------------------------------------------- pricing

    /// @notice Wallet risk multiplier in bps (10_000 = 1x). Rises with the wallet's onchain void ratio.
    function walletRiskMult(address claimant) public view returns (uint256) {
        (uint32 n, uint32 v) = claims.historyOf(claimant);
        if (n == 0) return BPS;
        return Math.min(BPS + uint256(riskSlopeBps) * v / n, MAX_RISK_MULT_BPS);
    }

    /// @notice Pure pricing function. Always <= amount; non-increasing in risk, wait and fee.
    function priceFor(uint256 amount, uint256 pRefundBps, uint256 riskMultBps, uint256 secondsToUnlock)
        public
        view
        returns (uint256)
    {
        uint256 risk = Math.min(pRefundBps * riskMultBps / BPS, BPS);
        uint256 tv = Math.min(uint256(timeValueBps) * secondsToUnlock / YEAR, BPS);
        uint256 p = Math.mulDiv(amount, BPS - risk, BPS);
        p = Math.mulDiv(p, BPS - tv, BPS);
        return Math.mulDiv(p, BPS - lpFeeBps, BPS);
    }

    /// @notice Live quote for a claim, plus when it becomes sellable. price = 0 if it can't be sold.
    function quote(uint256 id) public view returns (uint256 price, uint256 sellableAt) {
        IConditionalClaim.Claim memory c = claims.claimOf(id);
        CategoryParams memory p = categoryParams[c.category];
        if (c.status != IConditionalClaim.Status.Locked || c.equityToken != asset() || !p.enabled) return (0, 0);
        if (block.timestamp >= c.unlockAt) return (0, 0); // already settleable: just settle it
        sellableAt = uint256(c.mintedAt) + p.minHoldSeconds;
        price = priceFor(c.amount, p.pRefundBps, walletRiskMult(c.originalClaimant), c.unlockAt - block.timestamp);
    }

    // ---------------------------------------------------------------- trading

    /// @notice Sell a Locked claim for an immediate payout. Caller must own the claim and have approved
    ///         this pool on the ConditionalClaim contract.
    function sellClaim(uint256 id, uint256 minOut) external nonReentrant returns (uint256 price) {
        IConditionalClaim.Claim memory c = claims.claimOf(id);
        if (c.equityToken != asset()) revert WrongAsset();
        if (c.status != IConditionalClaim.Status.Locked || block.timestamp >= c.unlockAt) revert NotForSale(id);
        CategoryParams memory p = categoryParams[c.category];
        if (!p.enabled) revert CategoryDisabled(c.category);
        uint256 sellableAt = uint256(c.mintedAt) + p.minHoldSeconds;
        if (block.timestamp < sellableAt) revert MinHold(id, sellableAt);
        if (claims.ownerOf(id) != msg.sender) revert NotHolder();

        price = priceFor(c.amount, p.pRefundBps, walletRiskMult(c.originalClaimant), c.unlockAt - block.timestamp);
        if (price < minOut) revert Slippage(price, minOut);
        uint256 idle = _idle();
        if (price > idle) revert InsufficientLiquidity(price, idle);

        bookCost[id] = price;
        totalBooked += price;
        heldCount++;
        claimsBought++;
        IERC721Like(address(claims)).transferFrom(msg.sender, address(this), id);
        IERC20(asset()).safeTransfer(msg.sender, price);
        emit ClaimBought(id, msg.sender, c.amount, price);
    }

    /// @notice Called by ConditionalClaim when a held claim settles (gain) or is voided (loss).
    function onClaimResolved(uint256 id, bool settled) external {
        if (msg.sender != address(claims)) revert NotClaims();
        _resolve(id, settled);
    }

    /// @notice Permissionless repair if a resolution callback ever failed.
    function reconcile(uint256 id) external {
        IConditionalClaim.Status s = claims.claimOf(id).status;
        if (s == IConditionalClaim.Status.Settled) _resolve(id, true);
        else if (s == IConditionalClaim.Status.Voided) _resolve(id, false);
    }

    // ---------------------------------------------------------------- ERC-4626

    function totalAssets() public view override returns (uint256) {
        return _idle() + totalBooked;
    }

    function idleAssets() external view returns (uint256) {
        return _idle();
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner_), _idle());
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner_), _convertToShares(_idle(), Math.Rounding.Floor));
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------- internal

    function _idle() internal view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function _resolve(uint256 id, bool settled) internal {
        uint256 cost = bookCost[id];
        if (cost == 0) return;
        delete bookCost[id];
        totalBooked -= cost;
        heldCount--;
        uint256 proceeds;
        if (settled) {
            proceeds = claims.claimOf(id).amount;
            if (proceeds >= cost) realizedGains += proceeds - cost;
            else realizedLosses += cost - proceeds;
        } else {
            realizedLosses += cost;
        }
        emit ClaimResolved(id, settled, cost, proceeds);
    }

    function _setPricing(uint16 tv, uint16 fee, uint16 slope) internal {
        if (tv > MAX_TIME_VALUE_BPS || fee > MAX_LP_FEE_BPS || slope > MAX_RISK_SLOPE_BPS) revert BadParams();
        (timeValueBps, lpFeeBps, riskSlopeBps) = (tv, fee, slope);
        emit PricingSet(tv, fee, slope);
    }
}

interface IERC721Like {
    function transferFrom(address from, address to, uint256 id) external;
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IConditionalClaim, IClaimHolder} from "./interfaces/IConditionalClaim.sol";

interface IBudgetCredit {
    function creditBudget(bytes32 brandId, uint256 amount) external;
}

/// @title ConditionalClaim
/// @notice A stock-back reward is a *conditional* equity claim: the purchase can still be refunded.
///         Each claim escrows `amount` of a (mock) tokenized-equity ERC-20 until
///         `unlockAt = purchasedAt + returnWindow(category)`. Before that, an authorized refund proof
///         (via the VoidOracle) voids it and the escrow returns to the sponsor budget. After it, anyone
///         can `settle` and the equity goes to whoever holds the claim at that moment. While Locked, the
///         claim is a transferable position, which is what lets the InstantExitPool buy it.
/// @dev ERC-721 rather than ERC-1155: every claim has its own unlockAt, category, original claimant and
///      status, so no two positions are fungible. ERC-1155 would need one id per claim anyway, adding
///      batch/amount semantics we never use. The NFT is kept (not burned) after resolution as a
///      permanent record; it becomes non-transferable once Voided or Settled.
///      Escrow is tracked in storage (`escrowed`), never via balanceOf, so donations change nothing.
contract ConditionalClaim is IConditionalClaim, ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MAX_RETURN_WINDOW = 90 days;
    uint256 internal constant HOOK_GAS = 150_000;

    /// @notice RewardPool: the only minter, and where voided escrow returns.
    address public pool;
    /// @notice VoidOracle: the only contract that may void.
    address public voidOracle;

    uint256 public nextId = 1;
    mapping(uint256 => Claim) internal _claims;

    /// @notice Equity token => total amount escrowed by Locked claims.
    mapping(address => uint256) public escrowed;
    /// @notice Brand => category (1 = fashion, 2 = electronics, 3 = food, ...). 0 = not configured.
    mapping(bytes32 => uint8) public categoryOf;
    /// @notice Category => return window in seconds.
    mapping(uint8 => uint64) public returnWindow;
    /// @notice Category => true when the window is a short demo window (shown in the UI).
    mapping(uint8 => bool) public isDemoWindow;

    /// @notice Onchain refund history per original claimant.
    mapping(address => uint32) public claimsBy;
    mapping(address => uint32) public voidsBy;

    error NotPool();
    error NotVoidOracle();
    error AlreadyWired();
    error ZeroAddress();
    error BadConfig();
    error UnknownCategory(bytes32 brandId);
    error EscrowShortfall();
    error NotLocked(uint256 id);
    error StillLocked(uint256 id, uint64 unlockAt);
    error WindowClosed(uint256 id, uint64 unlockAt);
    error Frozen(uint256 id);

    event Wired(address indexed pool, address indexed voidOracle);
    event CategorySet(bytes32 indexed brandId, uint8 category);
    event ReturnWindowSet(uint8 indexed category, uint64 seconds_, bool demo);
    event ClaimMinted(
        uint256 indexed id,
        address indexed claimant,
        bytes32 indexed brandId,
        address equityToken,
        uint256 amount,
        uint8 category,
        uint64 unlockAt
    );
    event ClaimVoided(uint256 indexed id, address indexed holder, address indexed originalClaimant, uint256 amount);
    event ClaimSettled(uint256 indexed id, address indexed holder, uint256 amount);

    constructor(address owner_) ERC721("Zen Conditional Equity Claim", "ZEN-CLAIM") Ownable(owner_) {}

    // ---------------------------------------------------------------- config (demo admin)

    /// @notice One-time wiring after deployment. Cannot be changed afterwards.
    function wire(address pool_, address voidOracle_) external onlyOwner {
        if (pool != address(0)) revert AlreadyWired();
        if (pool_ == address(0) || voidOracle_ == address(0)) revert ZeroAddress();
        (pool, voidOracle) = (pool_, voidOracle_);
        emit Wired(pool_, voidOracle_);
    }

    /// @notice Demo admin: map a brand to its return-policy category. Production: timelock/governance.
    function setCategory(bytes32 brandId, uint8 category) external onlyOwner {
        if (brandId == 0 || category == 0) revert BadConfig();
        categoryOf[brandId] = category;
        emit CategorySet(brandId, category);
    }

    /// @notice Demo admin: set a category's return window. Only affects claims minted afterwards.
    function setReturnWindow(uint8 category, uint64 seconds_, bool demo) external onlyOwner {
        if (category == 0 || seconds_ > MAX_RETURN_WINDOW) revert BadConfig();
        returnWindow[category] = seconds_;
        isDemoWindow[category] = demo;
        emit ReturnWindowSet(category, seconds_, demo);
    }

    // ---------------------------------------------------------------- lifecycle

    /// @notice Pool transfers `amount` of `token` here, then mints. Unlock is anchored to the purchase.
    function mint(address to, bytes32 brandId, address token, uint256 amount, uint64 purchasedAt)
        external
        returns (uint256 id)
    {
        if (msg.sender != pool) revert NotPool();
        uint8 cat = categoryOf[brandId];
        if (cat == 0) revert UnknownCategory(brandId);
        uint256 nowEscrowed = escrowed[token] + amount;
        if (IERC20(token).balanceOf(address(this)) < nowEscrowed) revert EscrowShortfall();
        escrowed[token] = nowEscrowed;

        id = nextId++;
        uint64 unlockAt = purchasedAt + returnWindow[cat];
        _claims[id] = Claim({
            equityToken: token,
            category: cat,
            status: Status.Locked,
            unlockAt: unlockAt,
            amount: amount,
            originalClaimant: to,
            mintedAt: uint64(block.timestamp),
            brandId: brandId
        });
        claimsBy[to]++;
        _mint(to, id);
        emit ClaimMinted(id, to, brandId, token, amount, cat, unlockAt);
    }

    /// @notice Refund proven before unlock: escrow goes back to the sponsor budget, the holder gets nothing.
    function voidClaim(uint256 id) external nonReentrant {
        if (msg.sender != voidOracle) revert NotVoidOracle();
        Claim storage c = _claims[id];
        if (c.status != Status.Locked) revert NotLocked(id);
        if (block.timestamp >= c.unlockAt) revert WindowClosed(id, c.unlockAt);
        c.status = Status.Voided;
        escrowed[c.equityToken] -= c.amount;
        voidsBy[c.originalClaimant]++;
        address holder = _ownerOf(id);

        IERC20(c.equityToken).safeTransfer(pool, c.amount);
        IBudgetCredit(pool).creditBudget(c.brandId, c.amount);
        emit ClaimVoided(id, holder, c.originalClaimant, c.amount);
        _notify(holder, id, false);
    }

    /// @notice After the return window, anyone can settle: the equity goes to the current holder.
    function settle(uint256 id) external nonReentrant {
        Claim storage c = _claims[id];
        if (c.status != Status.Locked) revert NotLocked(id);
        if (block.timestamp < c.unlockAt) revert StillLocked(id, c.unlockAt);
        c.status = Status.Settled;
        escrowed[c.equityToken] -= c.amount;
        address holder = _ownerOf(id);

        IERC20(c.equityToken).safeTransfer(holder, c.amount);
        emit ClaimSettled(id, holder, c.amount);
        _notify(holder, id, true);
    }

    // ---------------------------------------------------------------- views

    function claimOf(uint256 id) external view returns (Claim memory) {
        return _claims[id];
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _claims[id].status;
    }

    /// @notice (claims, voids) for a wallet: the input to refund-risk pricing.
    function historyOf(address who) external view returns (uint32 claims, uint32 voids) {
        return (claimsBy[who], voidsBy[who]);
    }

    function ownerOf(uint256 id) public view override(ERC721, IConditionalClaim) returns (address) {
        return super.ownerOf(id);
    }

    // ---------------------------------------------------------------- internal

    /// @dev Positions move only while Locked; a resolved claim is a frozen record.
    function _update(address to, uint256 id, address auth) internal override returns (address from) {
        from = _ownerOf(id);
        if (from != address(0) && _claims[id].status != Status.Locked) revert Frozen(id);
        return super._update(to, id, auth);
    }

    /// @dev Best-effort, gas-capped callback so a holder contract (the exit pool) can book the result.
    ///      A failing or malicious holder can never block settlement or voiding.
    function _notify(address holder, uint256 id, bool settled) internal {
        if (holder.code.length == 0) return;
        try IClaimHolder(holder).onClaimResolved{gas: HOOK_GAS}(id, settled) {} catch {}
    }
}

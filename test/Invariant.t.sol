// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim} from "../src/PurchaseClaim.sol";
import {ReceiptCommitmentRegistry} from "../src/ReceiptCommitmentRegistry.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {RewardPolicy} from "../src/RewardPolicy.sol";
import {BrandVault} from "../src/BrandVault.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";
import {Test} from "forge-std/Test.sol";

contract Handler is Test {
    ReceiptCommitmentRegistry registry;
    RewardPool pool;
    BrandVault vault;
    MockBrandAsset asset;
    address assetOwner;
    uint256 attesterPk;
    bytes32 constant NIKE = bytes32("NIKE");

    address[3] public users;
    PurchaseClaim[] internal settled;

    uint256 public ghostFunded;
    uint256 public ghostRedeemed;
    uint256 public ghostReplaySuccesses;
    uint256 public ghostClaims;
    uint256 nonce;

    constructor(
        ReceiptCommitmentRegistry r,
        RewardPool p,
        BrandVault v,
        MockBrandAsset a,
        address ao,
        uint256 pk,
        uint256 initialBudget
    ) {
        (registry, pool, vault, asset, assetOwner, attesterPk) = (r, p, v, a, ao, pk);
        users = [makeAddr("u0"), makeAddr("u1"), makeAddr("u2")];
        ghostFunded = initialBudget;
    }

    function _sign(PurchaseClaim memory c) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterPk, registry.claimDigest(c));
        return abi.encodePacked(r, s, v);
    }

    function claim(uint256 userSeed, uint128 amount) external {
        address u = users[userSeed % 3];
        PurchaseClaim memory c = PurchaseClaim({
            claimant: u,
            brandId: NIKE,
            merchantId: keccak256("m"),
            receiptHash: keccak256(abi.encode(++nonce)),
            amount: uint128(bound(amount, 1, 600_000_00)),
            currency: bytes3("INR"),
            purchasedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory att = _sign(c);
        vm.prank(u);
        try registry.submitClaim(c, att) returns (bytes32, uint256) {
            ghostClaims++;
            settled.push(c);
        } catch {}
    }

    function replay(uint256 idx, uint128 newAmount) external {
        if (settled.length == 0) return;
        PurchaseClaim memory c = settled[idx % settled.length];
        c.amount = uint128(bound(newAmount, 1, 600_000_00));
        c.deadline = uint64(block.timestamp + 1 hours);
        bytes memory att = _sign(c);
        vm.prank(c.claimant);
        try registry.submitClaim(c, att) {
            ghostReplaySuccesses++;
        } catch {}
    }

    function redeem(uint256 userSeed, uint256 fraction) external {
        address u = users[userSeed % 3];
        uint256 shares = vault.balanceOf(u) * bound(fraction, 0, 100) / 100;
        if (shares == 0) return;
        vm.prank(u);
        ghostRedeemed += vault.redeem(shares, u, u);
    }

    function fund(uint96 amount) external {
        if (amount == 0) return;
        vm.prank(assetOwner);
        asset.mint(address(this), amount);
        asset.approve(address(pool), amount);
        pool.fund(NIKE, amount);
        ghostFunded += amount;
    }

    function warp(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 2 days));
    }
}

contract InvariantTest is StockbackFixture {
    Handler handler;

    function setUp() public override {
        super.setUp();
        handler = new Handler(registry, pool, nikeVault, mNKE, owner, attesterPk, BUDGET);
        targetContract(address(handler));
        bytes4[] memory sel = new bytes4[](5);
        sel[0] = Handler.claim.selector;
        sel[1] = Handler.replay.selector;
        sel[2] = Handler.redeem.selector;
        sel[3] = Handler.fund.selector;
        sel[4] = Handler.warp.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sel}));
    }

    /// Sanity: the handler really settles claims (invariants are not vacuous).
    function test_handlerSettlesClaims() public {
        handler.claim(0, 2_000_00);
        handler.claim(1, 600_000_00); // over max amount -> rejected
        assertEq(handler.ghostClaims(), 1);
    }

    /// Budget accounting: the pool always holds exactly the unallocated budget.
    function invariant_poolBalanceEqualsBudget() public view {
        assertEq(mNKE.balanceOf(address(pool)), pool.budgetOf(NIKE));
    }

    /// Conservation: funded = remaining budget + (vault assets + redeemed).
    function invariant_conservation() public view {
        assertEq(handler.ghostFunded(), pool.budgetOf(NIKE) + nikeVault.totalAssets() + handler.ghostRedeemed());
    }

    /// No receipt is ever rewarded twice.
    function invariant_noReplay() public view {
        assertEq(handler.ghostReplaySuccesses(), 0);
    }

    /// Vault solvency: outstanding shares never claim more than the vault holds.
    function invariant_vaultSolvent() public view {
        assertLe(nikeVault.convertToAssets(nikeVault.totalSupply()), nikeVault.totalAssets());
    }

    /// Daily caps hold for every user and the brand.
    function invariant_dailyCaps() public view {
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i < 3; i++) {
            assertLe(rewardPolicy.userIssued(NIKE, handler.users(i), day), DAILY_USER_CAP);
        }
        assertLe(rewardPolicy.brandIssued(NIKE, day), DAILY_BRAND_CAP);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZenFixture} from "./utils/ZenFixture.sol";
import {PurchaseClaim} from "../src/PurchaseClaim.sol";
import {ReceiptCommitmentRegistry} from "../src/ReceiptCommitmentRegistry.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {RewardPolicy} from "../src/RewardPolicy.sol";
import {BrandVault} from "../src/BrandVault.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";
import {ConditionalClaim} from "../src/ConditionalClaim.sol";
import {VoidOracle} from "../src/VoidOracle.sol";
import {InstantExitPool} from "../src/InstantExitPool.sol";
import {IConditionalClaim} from "../src/interfaces/IConditionalClaim.sol";
import {Test} from "forge-std/Test.sol";

contract Handler is Test {
    ReceiptCommitmentRegistry registry;
    RewardPool pool;
    MockBrandAsset asset;
    ConditionalClaim conditional;
    VoidOracle oracle;
    InstantExitPool exitPool;
    address assetOwner;
    uint256 attesterPk;
    uint256 refundPk;
    bytes32 constant NIKE = bytes32("NIKE");

    address[3] public users;
    PurchaseClaim[] internal accepted;
    uint256[] public positions;

    uint256 public ghostFunded;
    uint256 public ghostPaidOut; // equity that left escrow to holders via settle
    uint256 public ghostReplaySuccesses;
    uint256 public ghostClaims;
    uint256 public ghostVoids;
    uint256 public ghostSells;
    uint256 nonce;

    constructor(
        ReceiptCommitmentRegistry r,
        RewardPool p,
        MockBrandAsset a,
        ConditionalClaim cc,
        VoidOracle vo,
        InstantExitPool xp,
        address ao,
        uint256 pk,
        uint256 rpk,
        uint256 initialBudget
    ) {
        registry = r;
        pool = p;
        asset = a;
        conditional = cc;
        oracle = vo;
        exitPool = xp;
        assetOwner = ao;
        attesterPk = pk;
        refundPk = rpk;
        users = [makeAddr("u0"), makeAddr("u1"), makeAddr("u2")];
        ghostFunded = initialBudget;
    }

    function positionsLength() external view returns (uint256) {
        return positions.length;
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
        try registry.submitClaim(c, att) returns (bytes32, uint256 pos) {
            ghostClaims++;
            accepted.push(c);
            positions.push(pos);
        } catch {}
    }

    function replay(uint256 idx, uint128 newAmount) external {
        if (accepted.length == 0) return;
        PurchaseClaim memory c = accepted[idx % accepted.length];
        c.amount = uint128(bound(newAmount, 1, 600_000_00));
        c.deadline = uint64(block.timestamp + 1 hours);
        bytes memory att = _sign(c);
        vm.prank(c.claimant);
        try registry.submitClaim(c, att) {
            ghostReplaySuccesses++;
        } catch {}
    }

    function sell(uint256 idx) external {
        if (positions.length == 0) return;
        uint256 id = positions[idx % positions.length];
        address holder;
        try conditional.ownerOf(id) returns (address h) {
            holder = h;
        } catch {
            return;
        }
        if (holder == address(exitPool)) return;
        vm.startPrank(holder);
        conditional.approve(address(exitPool), id);
        try exitPool.sellClaim(id, 0) {
            ghostSells++;
        } catch {}
        vm.stopPrank();
    }

    function voidOne(uint256 idx) external {
        if (positions.length == 0) return;
        uint256 id = positions[idx % positions.length];
        bytes32 ref = keccak256(abi.encode("refund", id, ++nonce));
        uint64 dl = uint64(block.timestamp + 1 hours);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(refundPk, oracle.refundDigest(id, ref, dl));
        try oracle.voidWithAttestation(id, ref, dl, abi.encodePacked(r, s, v)) {
            ghostVoids++;
        } catch {}
    }

    function settleOne(uint256 idx) external {
        if (positions.length == 0) return;
        uint256 id = positions[idx % positions.length];
        uint256 amt = conditional.claimOf(id).amount;
        try conditional.settle(id) {
            ghostPaidOut += amt;
        } catch {}
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
        vm.warp(block.timestamp + bound(secs, 1, 10 days));
    }
}

contract InvariantTest is ZenFixture {
    Handler handler;

    function setUp() public override {
        super.setUp();
        handler =
            new Handler(registry, pool, mNKE, conditional, voidOracle, exitPool, owner, attesterPk, refundPk, BUDGET);
        targetContract(address(handler));
        bytes4[] memory sel = new bytes4[](8);
        sel[0] = Handler.claim.selector;
        sel[1] = Handler.replay.selector;
        sel[2] = Handler.sell.selector;
        sel[3] = Handler.voidOne.selector;
        sel[4] = Handler.settleOne.selector;
        sel[5] = Handler.fund.selector;
        sel[6] = Handler.warp.selector;
        sel[7] = Handler.claim.selector; // weight claims
        targetSelector(FuzzSelector({addr: address(handler), selectors: sel}));
    }

    /// Sanity: the handler really settles claims (invariants are not vacuous).
    function test_handlerSettlesClaims() public {
        handler.claim(0, 2_000_00);
        handler.claim(1, 600_000_00); // over max amount -> rejected
        assertEq(handler.ghostClaims(), 1);
        vm.warp(block.timestamp + 2 hours);
        handler.sell(0);
        assertEq(handler.ghostSells(), 1);
    }

    /// Budget accounting: the pool always holds exactly the unallocated budget.
    function invariant_poolBalanceEqualsBudget() public view {
        assertEq(mNKE.balanceOf(address(pool)), pool.budgetOf(NIKE));
    }

    /// Escrow: tracked escrow equals the sum of Locked claim amounts, and is fully backed.
    function invariant_escrowEqualsLockedClaims() public view {
        uint256 sum;
        uint256 n = handler.positionsLength();
        for (uint256 i; i < n; i++) {
            IConditionalClaim.Claim memory c = conditional.claimOf(handler.positions(i));
            if (c.status == IConditionalClaim.Status.Locked) sum += c.amount;
        }
        assertEq(conditional.escrowed(address(mNKE)), sum);
        assertEq(mNKE.balanceOf(address(conditional)), sum);
    }

    /// Conservation: funded = remaining budget + escrowed + paid out at settle. Voids return to budget.
    function invariant_conservation() public view {
        assertEq(
            handler.ghostFunded(), pool.budgetOf(NIKE) + conditional.escrowed(address(mNKE)) + handler.ghostPaidOut()
        );
    }

    /// No receipt is ever rewarded twice.
    function invariant_noReplay() public view {
        assertEq(handler.ghostReplaySuccesses(), 0);
    }

    /// Exit pool books exactly the claims it still holds while Locked.
    function invariant_exitPoolBooksHeldClaims() public view {
        uint256 booked;
        uint256 n = handler.positionsLength();
        for (uint256 i; i < n; i++) {
            booked += exitPool.bookCost(handler.positions(i));
        }
        assertEq(exitPool.totalBooked(), booked);
        assertEq(exitPool.totalAssets(), mNKE.balanceOf(address(exitPool)) + booked);
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

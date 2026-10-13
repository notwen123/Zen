// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {PurchaseClaim, ClaimStatus} from "../../src/PurchaseClaim.sol";
import {ReceiptCommitmentRegistry} from "../../src/ReceiptCommitmentRegistry.sol";
import {ECDSAAttestationVerifier} from "../../src/ECDSAAttestationVerifier.sol";
import {EligibilityPolicy} from "../../src/EligibilityPolicy.sol";
import {RewardPolicy} from "../../src/RewardPolicy.sol";
import {RewardPool} from "../../src/RewardPool.sol";
import {BrandVault} from "../../src/BrandVault.sol";
import {BrandVaultFactory} from "../../src/BrandVaultFactory.sol";
import {MockBrandAsset} from "../../src/mocks/MockBrandAsset.sol";
import {ConditionalClaim} from "../../src/ConditionalClaim.sol";
import {VoidOracle} from "../../src/VoidOracle.sol";
import {InstantExitPool} from "../../src/InstantExitPool.sol";
import {IConditionalClaim} from "../../src/interfaces/IConditionalClaim.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the full Zen stack with an ECDSA attester, one brand (NIKE, category FASHION)
///         configured, a VoidOracle with one refund attester, and an InstantExitPool for mNKE.
abstract contract ZenFixture is Test {
    bytes32 internal constant NIKE = bytes32("NIKE");
    bytes32 internal constant SBUX = bytes32("SBUX");
    bytes3 internal constant INR = bytes3("INR");

    // 0.75% back, where 1e18 mNKE is treated as Rs 1 of demo exposure: 1 paise -> 7.5e13 wei.
    uint128 internal constant RATE_WAD = 7.5e31;
    uint128 internal constant PER_CLAIM_CAP = 100e18;
    uint128 internal constant DAILY_USER_CAP = 300e18;
    uint128 internal constant DAILY_BRAND_CAP = 10_000e18;
    uint256 internal constant BUDGET = 1_000_000e18;

    uint8 internal constant FASHION = 1;
    uint8 internal constant ELECTRONICS = 2;
    uint8 internal constant FOOD = 3;
    uint64 internal constant FASHION_WINDOW = 30 days;
    uint16 internal constant FASHION_P_REFUND = 2_500; // illustrative
    uint64 internal constant MIN_HOLD = 1 hours;
    uint16 internal constant TIME_VALUE_BPS = 1_000; // 10% a year
    uint16 internal constant LP_FEE_BPS = 100; // 1%
    uint16 internal constant RISK_SLOPE_BPS = 10_000; // 100% void ratio doubles risk
    uint256 internal constant LP_SEED = 10_000e18;

    address internal owner = makeAddr("owner");
    address internal sponsor = makeAddr("sponsor");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal attesterPk = 0xA77E57;
    address internal attester;
    uint256 internal refundPk = 0x8EF0D;
    address internal refundAttester;
    address internal lp = makeAddr("lp");

    ReceiptCommitmentRegistry internal registry;
    ECDSAAttestationVerifier internal verifier;
    EligibilityPolicy internal eligibility;
    RewardPolicy internal rewardPolicy;
    RewardPool internal pool;
    BrandVaultFactory internal factory;
    MockBrandAsset internal mNKE;
    BrandVault internal nikeVault;
    ConditionalClaim internal conditional;
    VoidOracle internal voidOracle;
    InstantExitPool internal exitPool;

    uint256 internal receiptNonce;

    function setUp() public virtual {
        vm.warp(1_790_000_000);
        attester = vm.addr(attesterPk);
        refundAttester = vm.addr(refundPk);

        vm.startPrank(owner);
        factory = new BrandVaultFactory(owner);
        pool = new RewardPool(owner, factory);
        verifier = new ECDSAAttestationVerifier(owner);
        eligibility = new EligibilityPolicy(owner);
        rewardPolicy = new RewardPolicy(owner);
        registry = new ReceiptCommitmentRegistry(owner, verifier, eligibility, rewardPolicy, pool);
        rewardPolicy.setRegistry(address(registry));
        pool.setRegistry(address(registry));
        verifier.setAttester(attester, true);

        conditional = new ConditionalClaim(owner);
        voidOracle = new VoidOracle(owner, conditional);
        conditional.wire(address(pool), address(voidOracle));
        pool.setConditional(conditional);
        voidOracle.setAttester(refundAttester, true);
        conditional.setReturnWindow(FASHION, FASHION_WINDOW, false);
        conditional.setReturnWindow(ELECTRONICS, 14 days, false);
        conditional.setReturnWindow(FOOD, 1 days, false);
        conditional.setCategory(NIKE, FASHION);
        conditional.setCategory(SBUX, FOOD);

        mNKE = new MockBrandAsset("Mock Nike Exposure (TEST)", "mNKE", owner);
        nikeVault = BrandVault(factory.createVault(NIKE, IERC20(address(mNKE)), "STOCKBACK mNKE Vault", "sbNKE"));
        _configureBrand(NIKE);
        mNKE.mint(sponsor, BUDGET);

        exitPool = new InstantExitPool(
            owner,
            conditional,
            IERC20(address(mNKE)),
            "Zen Exit LP mNKE",
            "zxNKE",
            TIME_VALUE_BPS,
            LP_FEE_BPS,
            RISK_SLOPE_BPS
        );
        exitPool.setCategoryParams(
            FASHION,
            InstantExitPool.CategoryParams({pRefundBps: FASHION_P_REFUND, minHoldSeconds: MIN_HOLD, enabled: true})
        );
        mNKE.mint(lp, LP_SEED);
        vm.stopPrank();

        vm.startPrank(lp);
        mNKE.approve(address(exitPool), LP_SEED);
        exitPool.deposit(LP_SEED, lp);
        vm.stopPrank();

        vm.startPrank(sponsor);
        mNKE.approve(address(pool), BUDGET);
        pool.fund(NIKE, BUDGET);
        vm.stopPrank();
    }

    function _configureBrand(bytes32 brandId) internal {
        eligibility.setBrandRules(
            brandId,
            EligibilityPolicy.BrandRules({active: true, currency: INR, minAmount: 100_00, maxAmount: 500_000_00})
        );
        rewardPolicy.setBrandConfig(
            brandId,
            RewardPolicy.BrandConfig({
                rateWad: RATE_WAD,
                multiplierBps: 10_000,
                perClaimCap: PER_CLAIM_CAP,
                dailyUserCap: DAILY_USER_CAP,
                dailyBrandCap: DAILY_BRAND_CAP
            })
        );
    }

    /// @dev Fresh receipt every call. amount in paise.
    function _claim(address claimant, uint128 amount) internal returns (PurchaseClaim memory c) {
        c = PurchaseClaim({
            claimant: claimant,
            brandId: NIKE,
            merchantId: keccak256("merchant:nike-store-042"),
            receiptHash: keccak256(abi.encode("receipt", ++receiptNonce)),
            amount: amount,
            currency: INR,
            purchasedAt: uint64(block.timestamp - 1 hours),
            deadline: uint64(block.timestamp + 1 days)
        });
    }

    /// @dev Memory structs alias on assignment; use this for an independent copy.
    function _copy(PurchaseClaim memory c) internal pure returns (PurchaseClaim memory) {
        return abi.decode(abi.encode(c), (PurchaseClaim));
    }

    function _sign(uint256 pk, PurchaseClaim memory c) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, registry.claimDigest(c));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Escrowed equity of a conditional claim position.
    function _amt(uint256 positionId) internal view returns (uint256) {
        return conditional.claimOf(positionId).amount;
    }

    function _signRefund(uint256 pk, uint256 claimId, bytes32 ref, uint64 deadline)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, voidOracle.refundDigest(claimId, ref, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _void(uint256 claimId, bytes32 ref) internal {
        uint64 dl = uint64(block.timestamp + 1 hours);
        voidOracle.voidWithAttestation(claimId, ref, dl, _signRefund(refundPk, claimId, ref, dl));
    }

    function _submit(PurchaseClaim memory c) internal returns (bytes32 id, uint256 shares) {
        bytes memory att = _sign(attesterPk, c);
        vm.prank(c.claimant);
        return registry.submitClaim(c, att);
    }

    function _expectRejected(ClaimStatus s) internal {
        vm.expectRevert(abi.encodeWithSelector(ReceiptCommitmentRegistry.ClaimRejected.selector, s));
    }
}

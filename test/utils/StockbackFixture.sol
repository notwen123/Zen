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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the full STOCKBACK stack with an ECDSA attester, one brand (NIKE) configured.
abstract contract StockbackFixture is Test {
    bytes32 internal constant NIKE = bytes32("NIKE");
    bytes32 internal constant SBUX = bytes32("SBUX");
    bytes3 internal constant INR = bytes3("INR");

    // 0.75% back, where 1e18 mNKE is treated as Rs 1 of demo exposure: 1 paise -> 7.5e13 wei.
    uint128 internal constant RATE_WAD = 7.5e31;
    uint128 internal constant PER_CLAIM_CAP = 100e18;
    uint128 internal constant DAILY_USER_CAP = 300e18;
    uint128 internal constant DAILY_BRAND_CAP = 10_000e18;
    uint256 internal constant BUDGET = 1_000_000e18;

    address internal owner = makeAddr("owner");
    address internal sponsor = makeAddr("sponsor");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal attesterPk = 0xA77E57;
    address internal attester;

    ReceiptCommitmentRegistry internal registry;
    ECDSAAttestationVerifier internal verifier;
    EligibilityPolicy internal eligibility;
    RewardPolicy internal rewardPolicy;
    RewardPool internal pool;
    BrandVaultFactory internal factory;
    MockBrandAsset internal mNKE;
    BrandVault internal nikeVault;

    uint256 internal receiptNonce;

    function setUp() public virtual {
        vm.warp(1_790_000_000);
        attester = vm.addr(attesterPk);

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

        mNKE = new MockBrandAsset("Mock Nike Exposure (TEST)", "mNKE", owner);
        nikeVault = BrandVault(factory.createVault(NIKE, IERC20(address(mNKE)), "STOCKBACK mNKE Vault", "sbNKE"));
        _configureBrand(NIKE);
        mNKE.mint(sponsor, BUDGET);
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

    function _submit(PurchaseClaim memory c) internal returns (bytes32 id, uint256 shares) {
        bytes memory att = _sign(attesterPk, c);
        vm.prank(c.claimant);
        return registry.submitClaim(c, att);
    }

    function _expectRejected(ClaimStatus s) internal {
        vm.expectRevert(abi.encodeWithSelector(ReceiptCommitmentRegistry.ClaimRejected.selector, s));
    }
}

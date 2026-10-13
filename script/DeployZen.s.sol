// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReceiptCommitmentRegistry} from "../src/ReceiptCommitmentRegistry.sol";
import {ECDSAAttestationVerifier} from "../src/ECDSAAttestationVerifier.sol";
import {EligibilityPolicy} from "../src/EligibilityPolicy.sol";
import {RewardPolicy} from "../src/RewardPolicy.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {BrandVaultFactory} from "../src/BrandVaultFactory.sol";
import {ConditionalClaim} from "../src/ConditionalClaim.sol";
import {VoidOracle} from "../src/VoidOracle.sol";
import {InstantExitPool} from "../src/InstantExitPool.sol";
import {AUSDRewardAdapter} from "../src/AUSDRewardAdapter.sol";
import {ISwapRouter} from "../src/interfaces/ISwapRouter.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";

/// @notice DEMO / TESTNET deployment of the full Zen stack on Monad, with clearly labelled mock
///         tokenized-equity assets and a mock AUSD market. Runs only on anvil (31337), Monad testnet
///         (10143) or Monad mainnet (143); on mainnet every mock refuses to deploy by design, so a
///         mainnet deployment needs real, issuer-authorized equity tokens (not part of this demo).
///
/// Monad charges the gas LIMIT, not gas used: broadcast with a tight estimate multiplier, e.g.
///   forge script script/DeployZen.s.sol --rpc-url monad_testnet --broadcast --slow --gas-estimate-multiplier 110
///
/// Env:
///   DEPLOYER_PRIVATE_KEY  required
///   ATTESTER_ADDRESS      required - signs purchase claims (ECDSA) and, by default, refund attestations
///   REFUND_ATTESTER       optional - separate refund attester for the VoidOracle
///   DEMO_WINDOWS          optional - true (default) = 5-10 minute "demo" return windows; false = 14-30 days
///   BUDGET_PER_BRAND      optional - mock equity budget per brand (default 1,000,000e18)
contract DeployZen is Script {
    struct Brand {
        bytes32 id;
        string assetName;
        string assetSymbol;
        uint128 rateWad; // equity wei per paise, 1e18-scaled
        uint8 category;
        uint16 pRefundBps; // ILLUSTRATIVE refund probability for the category
    }

    uint8 constant FASHION = 1;
    uint8 constant ELECTRONICS = 2;
    uint8 constant FOOD = 3;

    uint128 constant PER_CLAIM_CAP = 100e18;
    uint128 constant DAILY_USER_CAP = 300e18;
    uint128 constant DAILY_BRAND_CAP = 100_000e18;

    uint16 constant TIME_VALUE_BPS = 1_000; // 10%/yr for waiting until unlock
    uint16 constant LP_FEE_BPS = 100; // 1%
    uint16 constant RISK_SLOPE_BPS = 10_000; // a wallet that voids everything doubles its category risk

    function _brands() internal pure returns (Brand[3] memory b) {
        b[0] = Brand("NIKE", "Mock Nike Equity (TEST)", "mNKE", 7.5e31, FASHION, 2_500); // 0.75% back
        b[1] = Brand("AAPL", "Mock Apple Equity (TEST)", "mAAPL", 5e31, ELECTRONICS, 1_000); // 0.5% back
        b[2] = Brand("SBUX", "Mock Starbucks Equity (TEST)", "mSBUX", 1e32, FOOD, 300); // 1% back
    }

    function _allowedChain(uint256 id) internal pure returns (bool) {
        return id == 31337 || id == 10143 || id == 143; // anvil, Monad testnet, Monad mainnet
    }

    BrandVaultFactory factory;
    RewardPool pool;
    ECDSAAttestationVerifier ecdsa;
    EligibilityPolicy eligibility;
    RewardPolicy rewardPolicy;
    ReceiptCommitmentRegistry registry;
    ConditionalClaim conditional;
    VoidOracle voidOracle;
    AUSDRewardAdapter adapter;
    MockAUSD ausd;
    MockSwapRouter router;
    address[3] assets;
    address[3] vaults;
    address[3] exitPools;

    function run() external {
        require(_allowedChain(block.chainid), "DeployZen: refuses chains other than 31337, 10143, 143");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        address refundAttester = vm.envOr("REFUND_ATTESTER", attester);
        bool demo = vm.envOr("DEMO_WINDOWS", true);
        uint256 budget = vm.envOr("BUDGET_PER_BRAND", uint256(1_000_000e18));
        require(attester != address(0), "DeployZen: ATTESTER_ADDRESS is zero");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        _deployCore(deployer, attester, refundAttester, demo);
        _deployAusdMarket(deployer);
        Brand[3] memory brands = _brands();
        for (uint256 i; i < 3; i++) {
            _deployBrand(i, brands[i], deployer, budget, demo);
        }
        vm.stopBroadcast();

        _write(deployer, attester, refundAttester, demo, brands);
    }

    function _deployCore(address deployer, address attester, address refundAttester, bool demo) internal {
        factory = new BrandVaultFactory(deployer);
        pool = new RewardPool(deployer, factory);
        ecdsa = new ECDSAAttestationVerifier(deployer);
        ecdsa.setAttester(attester, true);
        eligibility = new EligibilityPolicy(deployer);
        rewardPolicy = new RewardPolicy(deployer);
        registry = new ReceiptCommitmentRegistry(deployer, ecdsa, eligibility, rewardPolicy, pool);
        rewardPolicy.setRegistry(address(registry));
        pool.setRegistry(address(registry));

        conditional = new ConditionalClaim(deployer);
        voidOracle = new VoidOracle(deployer, conditional);
        conditional.wire(address(pool), address(voidOracle));
        pool.setConditional(conditional);
        voidOracle.setAttester(refundAttester, true);
        // Demo windows are labelled on-chain (isDemoWindow) and in the UI.
        conditional.setReturnWindow(FASHION, demo ? 10 minutes : 30 days, demo);
        conditional.setReturnWindow(ELECTRONICS, demo ? 8 minutes : 14 days, demo);
        conditional.setReturnWindow(FOOD, demo ? 5 minutes : 14 days, demo);
    }

    /// Mock AUSD market for the optional stablecoin funding path (demo price: $0.01 per mock unit).
    function _deployAusdMarket(address deployer) internal {
        ausd = new MockAUSD();
        router = new MockSwapRouter();
        adapter = new AUSDRewardAdapter(deployer, ausd, pool, factory, ISwapRouter(address(router)));
        adapter.setOracleStaleAfter(365 days); // hand-set demo feed never updates on its own
        ausd.mint(deployer, 1_000_000e6);
    }

    function _deployBrand(uint256 i, Brand memory b, address deployer, uint256 budget, bool demo) internal {
        MockBrandAsset a = new MockBrandAsset(b.assetName, b.assetSymbol, deployer);
        assets[i] = address(a);
        vaults[i] = factory.createVault(
            b.id, IERC20(address(a)), string.concat("Zen ", b.assetSymbol, " Vault"), string.concat("z", b.assetSymbol)
        );
        eligibility.setBrandRules(
            b.id,
            EligibilityPolicy.BrandRules({
                active: true, currency: bytes3("INR"), minAmount: 100_00, maxAmount: 500_000_00
            })
        );
        rewardPolicy.setBrandConfig(
            b.id,
            RewardPolicy.BrandConfig({
                rateWad: b.rateWad,
                multiplierBps: 10_000,
                perClaimCap: PER_CLAIM_CAP,
                dailyUserCap: DAILY_USER_CAP,
                dailyBrandCap: DAILY_BRAND_CAP
            })
        );
        conditional.setCategory(b.id, b.category);

        InstantExitPool xp = new InstantExitPool(
            deployer,
            conditional,
            IERC20(address(a)),
            string.concat("Zen Exit LP ", b.assetSymbol),
            string.concat("zx", b.assetSymbol),
            TIME_VALUE_BPS,
            LP_FEE_BPS,
            RISK_SLOPE_BPS
        );
        xp.setCategoryParams(
            b.category,
            InstantExitPool.CategoryParams({
                pRefundBps: b.pRefundBps, minHoldSeconds: demo ? 60 : 1 days, enabled: true
            })
        );
        exitPools[i] = address(xp);

        a.mint(deployer, budget);
        a.approve(address(pool), budget);
        pool.fund(b.id, budget);

        adapter.setPriceFeed(b.id, new MockAggregatorV3(8, 1e6));
        router.setRate(address(ausd), address(a), 1e32);
        a.mint(address(router), budget);
    }

    function _write(address deployer, address attester, address refundAttester, bool demo, Brand[3] memory brands)
        internal
    {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "attester", attester);
        vm.serializeAddress(k, "refundAttester", refundAttester);
        vm.serializeAddress(k, "registry", address(registry));
        vm.serializeAddress(k, "verifier", address(ecdsa));
        vm.serializeAddress(k, "eligibilityPolicy", address(eligibility));
        vm.serializeAddress(k, "rewardPolicy", address(rewardPolicy));
        vm.serializeAddress(k, "rewardPool", address(pool));
        vm.serializeAddress(k, "brandVaultFactory", address(factory));
        vm.serializeAddress(k, "conditionalClaim", address(conditional));
        vm.serializeAddress(k, "voidOracle", address(voidOracle));
        vm.serializeAddress(k, "ausdRewardAdapter", address(adapter));
        vm.serializeAddress(k, "mockAUSD", address(ausd));
        vm.serializeAddress(k, "mockSwapRouter", address(router));
        vm.serializeBool(k, "demoWindows", demo);
        for (uint256 i; i < 3; i++) {
            vm.serializeAddress(k, string.concat(brands[i].assetSymbol, "Asset"), assets[i]);
            vm.serializeAddress(k, string.concat(brands[i].assetSymbol, "Vault"), vaults[i]);
            vm.serializeAddress(k, string.concat(brands[i].assetSymbol, "ExitPool"), exitPools[i]);
        }
        string memory json = vm.serializeBool(k, "mocks", true);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("=== ZEN DEMO DEPLOYMENT (mock assets) ===");
        console2.log("chainId          ", block.chainid);
        console2.log("registry         ", address(registry));
        console2.log("conditionalClaim ", address(conditional));
        console2.log("voidOracle       ", address(voidOracle));
        console2.log("rewardPool       ", address(pool));
        for (uint256 i; i < 3; i++) {
            console2.log(brands[i].assetSymbol, assets[i], exitPools[i]);
        }
        console2.log("written to", path);
    }
}

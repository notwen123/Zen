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
import {USDGRewardAdapter} from "../src/USDGRewardAdapter.sol";
import {IReceiptVerifier} from "../src/interfaces/IReceiptVerifier.sol";
import {ISwapRouter} from "../src/interfaces/ISwapRouter.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";

/// @notice DEMO / TESTNET deployment of the full STOCKBACK stack with clearly-labelled mock
///         brand assets and a mock USDG market. Refuses any chain not listed in
///         config/networks.json as a demo network.
///
/// Env:
///   DEPLOYER_PRIVATE_KEY  required
///   ATTESTER_ADDRESS      required - ECDSA attester allowed by ECDSAAttestationVerifier
///   STYLUS_VERIFIER       optional - deployed stylus/receipt-prover; used as the registry verifier
///   BUDGET_PER_BRAND      optional - mock brand-asset budget per brand (default 1,000,000e18)
contract DeployStockback is Script {
    struct Brand {
        bytes32 id;
        string assetName;
        string assetSymbol;
        string vaultName;
        string vaultSymbol;
        uint128 rateWad; // brand-asset wei per paise, 1e18-scaled
    }

    // Demo economics (see docs/ECONOMICS in README): 1e18 mock units ~ Rs 1 of demo exposure.
    uint128 constant PER_CLAIM_CAP = 100e18;
    uint128 constant DAILY_USER_CAP = 300e18;
    uint128 constant DAILY_BRAND_CAP = 100_000e18;

    function _brands() internal pure returns (Brand[3] memory b) {
        b[0] = Brand("NIKE", "Mock Nike Exposure (TEST)", "mNKE", "STOCKBACK mNKE Vault", "sbNKE", 7.5e31); // 0.75%
        b[1] = Brand("SBUX", "Mock Starbucks Exposure (TEST)", "mSBUX", "STOCKBACK mSBUX Vault", "sbSBUX", 1e32); // 1%
        b[2] = Brand("AAPL", "Mock Apple Exposure (TEST)", "mAAPL", "STOCKBACK mAAPL Vault", "sbAAPL", 5e31); // 0.5%
    }

    function _isDemoChain(uint256 id) internal pure returns (bool) {
        return id == 31337 || id == 46630 || id == 421614; // anvil, Robinhood testnet, Arbitrum Sepolia
    }

    BrandVaultFactory factory;
    RewardPool pool;
    ECDSAAttestationVerifier ecdsa;
    EligibilityPolicy eligibility;
    RewardPolicy rewardPolicy;
    ReceiptCommitmentRegistry registry;
    IReceiptVerifier active;
    USDGRewardAdapter adapter;
    MockUSDG usdg;
    MockSwapRouter router;
    address[3] assets;
    address[3] vaults;

    function run() external {
        require(_isDemoChain(block.chainid), "DeployStockback: demo deploy refuses this chain");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        address stylusVerifier = vm.envOr("STYLUS_VERIFIER", address(0));
        uint256 budget = vm.envOr("BUDGET_PER_BRAND", uint256(1_000_000e18));
        require(attester != address(0), "DeployStockback: ATTESTER_ADDRESS is zero");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        _deployCore(deployer, attester, stylusVerifier);
        _deployUsdgMarket(deployer);
        Brand[3] memory brands = _brands();
        for (uint256 i; i < 3; i++) {
            (assets[i], vaults[i]) = _deployBrand(brands[i], deployer, budget);
            adapter.setPriceFeed(brands[i].id, new MockAggregatorV3(8, 1e6));
            router.setRate(address(usdg), assets[i], 1e32);
            MockBrandAsset(assets[i]).mint(address(router), budget);
        }
        vm.stopBroadcast();

        _write(deployer, attester, brands);
    }

    function _deployCore(address deployer, address attester, address stylusVerifier) internal {
        factory = new BrandVaultFactory(deployer);
        pool = new RewardPool(deployer, factory);
        ecdsa = new ECDSAAttestationVerifier(deployer);
        ecdsa.setAttester(attester, true);
        eligibility = new EligibilityPolicy(deployer);
        rewardPolicy = new RewardPolicy(deployer);
        active = stylusVerifier == address(0) ? IReceiptVerifier(ecdsa) : IReceiptVerifier(stylusVerifier);
        registry = new ReceiptCommitmentRegistry(deployer, active, eligibility, rewardPolicy, pool);
        rewardPolicy.setRegistry(address(registry));
        pool.setRegistry(address(registry));
    }

    /// Mock USDG market for the optional USDG funding path (demo price: $0.01 per mock unit).
    function _deployUsdgMarket(address deployer) internal {
        usdg = new MockUSDG();
        router = new MockSwapRouter();
        adapter = new USDGRewardAdapter(deployer, usdg, pool, factory, ISwapRouter(address(router)));
        adapter.setOracleStaleAfter(365 days); // hand-set demo feed never updates on its own
        usdg.mint(deployer, 1_000_000e6);
    }

    function _write(address deployer, address attester, Brand[3] memory brands) internal {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "attester", attester);
        vm.serializeAddress(k, "registry", address(registry));
        vm.serializeAddress(k, "verifier", address(active));
        vm.serializeAddress(k, "ecdsaVerifier", address(ecdsa));
        vm.serializeAddress(k, "eligibilityPolicy", address(eligibility));
        vm.serializeAddress(k, "rewardPolicy", address(rewardPolicy));
        vm.serializeAddress(k, "rewardPool", address(pool));
        vm.serializeAddress(k, "brandVaultFactory", address(factory));
        vm.serializeAddress(k, "usdgRewardAdapter", address(adapter));
        vm.serializeAddress(k, "mockUSDG", address(usdg));
        vm.serializeAddress(k, "mockSwapRouter", address(router));
        for (uint256 i; i < 3; i++) {
            vm.serializeAddress(k, string.concat(brands[i].assetSymbol, "Asset"), assets[i]);
            vm.serializeAddress(k, string.concat(brands[i].assetSymbol, "Vault"), vaults[i]);
        }
        string memory json = vm.serializeBool(k, "mocks", true);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("=== STOCKBACK DEMO DEPLOYMENT (mock assets) ===");
        console2.log("chainId          ", block.chainid);
        console2.log("registry         ", address(registry));
        console2.log("verifier (active)", address(active));
        console2.log("ecdsaVerifier    ", address(ecdsa));
        console2.log("eligibilityPolicy", address(eligibility));
        console2.log("rewardPolicy     ", address(rewardPolicy));
        console2.log("rewardPool       ", address(pool));
        console2.log("factory          ", address(factory));
        console2.log("usdgAdapter      ", address(adapter));
        console2.log("mockUSDG         ", address(usdg));
        for (uint256 i; i < 3; i++) {
            console2.log(brands[i].assetSymbol, assets[i], vaults[i]);
        }
        console2.log("written to", path);
    }

    function _deployBrand(Brand memory b, address deployer, uint256 budget)
        internal
        returns (address asset, address vault)
    {
        MockBrandAsset a = new MockBrandAsset(b.assetName, b.assetSymbol, deployer);
        asset = address(a);
        vault = factory.createVault(b.id, IERC20(asset), b.vaultName, b.vaultSymbol);
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
        a.mint(deployer, budget);
        a.approve(address(pool), budget);
        pool.fund(b.id, budget);
    }
}

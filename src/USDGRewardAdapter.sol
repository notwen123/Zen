// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IBrandVaultFactory} from "./interfaces/IBrandVaultFactory.sol";
import {IRewardPool} from "./interfaces/IRewardPool.sol";

/// @title USDGRewardAdapter
/// @notice Optional funding path: a sponsor pays the reward budget in USDG; the adapter swaps
///         it into the brand asset and credits RewardPool. No yield is assumed or claimed.
/// @dev Oracle freshness/positivity checks and oracle-derived minOut with a 10% hard slippage
///      ceiling are adapted from Wield `Vault._buyStockWithUsdg`. Assumes 1 USDG ~= 1 USD.
///      The adapter holds no funds between transactions.
contract USDGRewardAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_SLIPPAGE_CEILING_BPS = 1000;

    IERC20 public immutable usdg;
    IRewardPool public immutable pool;
    IBrandVaultFactory public immutable factory;

    ISwapRouter public router;
    uint24 public poolFee = 3000;
    uint16 public maxSlippageBps = 100;
    uint256 public oracleStaleAfter = 1 hours;

    /// @notice brandId => USD price feed of the brand asset.
    mapping(bytes32 => IAggregatorV3) public priceFeed;

    error ZeroAddress();
    error ZeroAmount();
    error NoFeed(bytes32 brandId);
    error NoVault(bytes32 brandId);
    error StaleOracle();
    error BadOraclePrice();
    error SlippageTooHigh();

    event RouterSet(address indexed router, uint24 poolFee);
    event PriceFeedSet(bytes32 indexed brandId, address indexed feed);
    event MaxSlippageSet(uint16 bps);
    event OracleStaleAfterSet(uint256 secondsValue);
    event FundedWithUSDG(bytes32 indexed brandId, address indexed sponsor, uint256 usdgIn, uint256 assetOut);

    constructor(address owner_, IERC20 usdg_, IRewardPool pool_, IBrandVaultFactory factory_, ISwapRouter router_)
        Ownable(owner_)
    {
        if (address(usdg_) == address(0) || address(pool_) == address(0) || address(factory_) == address(0)) {
            revert ZeroAddress();
        }
        usdg = usdg_;
        pool = pool_;
        factory = factory_;
        _setRouter(router_, poolFee);
    }

    function setRouter(ISwapRouter r, uint24 fee) external onlyOwner {
        _setRouter(r, fee);
    }

    function setPriceFeed(bytes32 brandId, IAggregatorV3 feed) external onlyOwner {
        priceFeed[brandId] = feed;
        emit PriceFeedSet(brandId, address(feed));
    }

    function setMaxSlippageBps(uint16 bps) external onlyOwner {
        if (bps > MAX_SLIPPAGE_CEILING_BPS) revert SlippageTooHigh();
        maxSlippageBps = bps;
        emit MaxSlippageSet(bps);
    }

    function setOracleStaleAfter(uint256 s) external onlyOwner {
        oracleStaleAfter = s;
        emit OracleStaleAfterSet(s);
    }

    /// @notice Oracle-implied brand-asset amount for `usdgIn`, before slippage.
    function expectedOut(bytes32 brandId, uint256 usdgIn) public view returns (uint256) {
        IAggregatorV3 feed = priceFeed[brandId];
        if (address(feed) == address(0)) revert NoFeed(brandId);
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert BadOraclePrice();
        if (block.timestamp - updatedAt > oracleStaleAfter) revert StaleOracle();

        uint256 assetDec = IERC20Metadata(_asset(brandId)).decimals();
        uint256 usdgDec = IERC20Metadata(address(usdg)).decimals();
        // out = usdgIn * 10^assetDec * 10^feedDec / (price * 10^usdgDec); answer > 0 checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return (usdgIn * 10 ** assetDec * 10 ** feed.decimals()) / (uint256(answer) * 10 ** usdgDec);
    }

    function fundWithUSDG(bytes32 brandId, uint256 usdgIn) external nonReentrant returns (uint256 assetOut) {
        if (usdgIn == 0) revert ZeroAmount();
        address asset = _asset(brandId);
        uint256 minOut = (expectedOut(brandId, usdgIn) * (10_000 - maxSlippageBps)) / 10_000;

        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        usdg.forceApprove(address(router), usdgIn);
        assetOut = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(usdg),
                tokenOut: asset,
                fee: poolFee,
                recipient: address(this),
                amountIn: usdgIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );

        IERC20(asset).forceApprove(address(pool), assetOut);
        pool.fund(brandId, assetOut);
        emit FundedWithUSDG(brandId, msg.sender, usdgIn, assetOut);
    }

    function _asset(bytes32 brandId) internal view returns (address) {
        address v = factory.vaultOf(brandId);
        if (v == address(0)) revert NoVault(brandId);
        return IERC4626(v).asset();
    }

    function _setRouter(ISwapRouter r, uint24 fee) internal {
        if (address(r) == address(0)) revert ZeroAddress();
        router = r;
        poolFee = fee;
        emit RouterSet(address(r), fee);
    }
}

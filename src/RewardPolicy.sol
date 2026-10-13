// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PurchaseClaim, ClaimStatus} from "./PurchaseClaim.sol";
import {IRewardPolicy} from "./interfaces/IRewardPolicy.sol";

/// @title RewardPolicy
/// @notice reward = amount * rateWad / 1e18 * multiplierBps / 10_000, clipped to perClaimCap,
///         then rejected (not clipped) if it would exceed the per-user or per-brand daily cap,
///         so an over-cap receipt stays claimable the next day instead of being burned.
/// @dev `rateWad` = brand-asset base units per 1 minor currency unit, 1e18-scaled. It is a
///      sponsor-set conversion (like "points per rupee"), not a market price.
contract RewardPolicy is IRewardPolicy, Ownable {
    struct BrandConfig {
        uint128 rateWad;
        uint16 multiplierBps; // 10_000 = 1x, max 3x
        uint128 perClaimCap;
        uint128 dailyUserCap;
        uint128 dailyBrandCap;
    }

    uint16 public constant MAX_MULTIPLIER_BPS = 30_000;

    address public registry;
    mapping(bytes32 => BrandConfig) public config;

    /// @notice brand => day => rewards issued.
    mapping(bytes32 => mapping(uint256 => uint256)) public brandIssued;
    /// @notice brand => user => day => rewards issued.
    mapping(bytes32 => mapping(address => mapping(uint256 => uint256))) public userIssued;

    error NotRegistry();
    error BadConfig();
    error Rejected(ClaimStatus status);

    event RegistrySet(address indexed registry);
    event BrandConfigSet(bytes32 indexed brandId, BrandConfig config);

    constructor(address owner_) Ownable(owner_) {}

    function setRegistry(address r) external onlyOwner {
        if (r == address(0)) revert BadConfig();
        registry = r;
        emit RegistrySet(r);
    }

    function setBrandConfig(bytes32 brandId, BrandConfig calldata c) external onlyOwner {
        if (
            brandId == 0 || c.rateWad == 0 || c.multiplierBps == 0 || c.multiplierBps > MAX_MULTIPLIER_BPS
                || c.perClaimCap == 0 || c.dailyUserCap < c.perClaimCap || c.dailyBrandCap < c.dailyUserCap
        ) revert BadConfig();
        config[brandId] = c;
        emit BrandConfigSet(brandId, c);
    }

    function quote(PurchaseClaim calldata c) public view returns (ClaimStatus, uint256 reward) {
        BrandConfig memory cfg = config[c.brandId];
        // 512-bit intermediate: amount (<=2^128) * rateWad (<2^128) * bps (<2^15) cannot overflow.
        reward = Math.mulDiv(uint256(c.amount) * cfg.rateWad, cfg.multiplierBps, 1e18 * 10_000);
        if (reward > cfg.perClaimCap) reward = cfg.perClaimCap;
        if (reward == 0) return (ClaimStatus.ZeroReward, 0);

        uint256 day = block.timestamp / 1 days;
        if (userIssued[c.brandId][c.claimant][day] + reward > cfg.dailyUserCap) {
            return (ClaimStatus.UserDailyCapReached, 0);
        }
        if (brandIssued[c.brandId][day] + reward > cfg.dailyBrandCap) return (ClaimStatus.BrandDailyCapReached, 0);
        return (ClaimStatus.Ok, reward);
    }

    function consume(PurchaseClaim calldata c) external returns (uint256 reward) {
        if (msg.sender != registry) revert NotRegistry();
        ClaimStatus status;
        (status, reward) = quote(c);
        if (status != ClaimStatus.Ok) revert Rejected(status);
        uint256 day = block.timestamp / 1 days;
        userIssued[c.brandId][c.claimant][day] += reward;
        brandIssued[c.brandId][day] += reward;
    }
}

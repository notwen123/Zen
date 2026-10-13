// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Adapter for jurisdiction / KYC / identity decisions made by a compliance provider.
///         STOCKBACK does not hardcode geography; production deployments plug an
///         issuer-approved provider in here.
interface IJurisdictionPolicy {
    function isEligible(address claimant, bytes32 brandId) external view returns (bool);
}

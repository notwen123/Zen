// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PurchaseClaim, ClaimStatus} from "../PurchaseClaim.sol";

interface IRewardPolicy {
    /// @notice Reward (in brand-asset base units) and whether caps allow it. No state change.
    function quote(PurchaseClaim calldata claim) external view returns (ClaimStatus status, uint256 reward);

    /// @notice Same computation as `quote`, but records usage against daily caps.
    ///         Only callable by the registry. Reverts unless status is Ok.
    function consume(PurchaseClaim calldata claim) external returns (uint256 reward);
}

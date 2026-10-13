// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PurchaseClaim, ClaimStatus} from "../PurchaseClaim.sol";

interface IEligibilityPolicy {
    /// @return ClaimStatus.Ok if the claim may be rewarded, otherwise the rejection reason.
    function check(PurchaseClaim calldata claim) external view returns (ClaimStatus);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IConditionalClaim {
    enum Status {
        None,
        Locked,
        Voided,
        Settled
    }

    struct Claim {
        address equityToken; // tokenized-equity ERC-20 held in escrow
        uint8 category; // return-policy category of the purchase
        Status status;
        uint64 unlockAt; // purchasedAt + returnWindow(category)
        uint256 amount; // escrowed equity, token base units
        address originalClaimant; // who made the purchase (risk history is keyed on this)
        uint64 mintedAt;
        bytes32 brandId;
    }

    function mint(address to, bytes32 brandId, address token, uint256 amount, uint64 purchasedAt)
        external
        returns (uint256 id);
    function voidClaim(uint256 id) external;
    function settle(uint256 id) external;
    function claimOf(uint256 id) external view returns (Claim memory);
    function historyOf(address who) external view returns (uint32 claims, uint32 voids);
    function ownerOf(uint256 id) external view returns (address);
}

/// @notice Implemented by contracts that hold claims and must book their resolution.
interface IClaimHolder {
    function onClaimResolved(uint256 id, bool settled) external;
}

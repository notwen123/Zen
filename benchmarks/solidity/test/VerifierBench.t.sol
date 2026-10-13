// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";

interface IBatchVerifier {
    function setAttester(bytes32 pubkey, bool allowed) external;
    function verify(bytes32 digest, bytes calldata attestation) external view returns (bool);
    function verifyBatch(bytes32[] calldata digests, bytes[] calldata attestations) external view returns (bool);
    function verifyBatchNaive(bytes32[] calldata digests, bytes[] calldata attestations)
        external
        view
        returns (bool);
}

interface IECDSAVerifier {
    function setAttester(address attester, bool allowed) external;
    function verifyBatch(bytes32[] calldata digests, bytes[] calldata attestations) external view returns (bool);
}

/// @notice Correctness + local EVM execution gas for the Solidity verifiers, on the exact
///         fixtures run_onchain.sh sends to the Stylus verifier.
contract VerifierBench is Test {
    IBatchVerifier ed;
    IECDSAVerifier ec;
    bytes32[] digests;
    bytes[] edAtts;
    bytes[] ecAtts;

    function setUp() public {
        string memory json = vm.readFile("../fixtures/vectors.json");
        digests = vm.parseJsonBytes32Array(json, ".digests");
        edAtts = vm.parseJsonBytesArray(json, ".ed25519");
        ecAtts = vm.parseJsonBytesArray(json, ".ecdsa");

        ed = IBatchVerifier(deployCode("Ed25519Verifier.sol:Ed25519Verifier", abi.encode(address(this))));
        ed.setAttester(vm.parseJsonBytes32(json, ".ed25519Pubkey"), true);
        ec = IECDSAVerifier(deployCode("ECDSABatchVerifier.sol:ECDSABatchVerifier", abi.encode(address(this))));
        ec.setAttester(vm.parseJsonAddress(json, ".ecdsaSigner"), true);
    }

    function _slice(uint256 n) internal view returns (bytes32[] memory d, bytes[] memory e, bytes[] memory c) {
        d = new bytes32[](n);
        e = new bytes[](n);
        c = new bytes[](n);
        for (uint256 i; i < n; i++) {
            (d[i], e[i], c[i]) = (digests[i], edAtts[i], ecAtts[i]);
        }
    }

    function test_solidityEd25519_acceptsAllVectors() public view {
        (bytes32[] memory d, bytes[] memory e,) = _slice(100);
        assertTrue(ed.verifyBatch(d, e));
    }

    function test_solidityEd25519_rejectsTampering() public view {
        bytes memory a = edAtts[0];
        assertFalse(ed.verify(digests[1], a), "wrong digest");
        bytes memory bad = bytes.concat(a);
        bad[40] ^= 0x01;
        assertFalse(ed.verify(digests[0], bad), "flipped R bit");
        bytes memory hiS = bytes.concat(a);
        hiS[95] |= 0xf0; // S >= L (non-canonical)
        assertFalse(ed.verify(digests[0], hiS), "non-canonical S");
        assertFalse(ed.verify(digests[0], ""), "empty");
    }

    function test_ecdsa_acceptsAllVectors() public view {
        (bytes32[] memory d,, bytes[] memory c) = _slice(100);
        assertTrue(ec.verifyBatch(d, c));
    }

    function _measure(uint256 n) internal returns (uint256[3] memory g) {
        (bytes32[] memory d, bytes[] memory e, bytes[] memory c) = _slice(n);
        uint256 g0 = gasleft();
        bool ok = ed.verifyBatch(d, e);
        g[0] = g0 - gasleft();
        g0 = gasleft();
        ok = ok && ed.verifyBatchNaive(d, e);
        g[1] = g0 - gasleft();
        g0 = gasleft();
        ok = ok && ec.verifyBatch(d, c);
        g[2] = g0 - gasleft();
        assertTrue(ok);
    }

    function _row(uint256 n, uint256[3] memory g) internal pure returns (string memory) {
        return string.concat(
            string.concat("| ", vm.toString(n), " | ", vm.toString(g[0]), " | ", vm.toString(g[0] / n)),
            string.concat(" | ", vm.toString(g[1]), " | ", vm.toString(g[2]), " | ", vm.toString(g[2] / n), " |\n")
        );
    }

    function test_gas_report() public {
        uint256[4] memory ns = [uint256(1), 10, 50, 100];
        string memory out =
            "| batch | Solidity Ed25519 (gas) | per sig | Ed25519 naive loop (gas) | Solidity ECDSA (gas) | per sig |\n|---:|---:|---:|---:|---:|---:|\n";
        for (uint256 k; k < ns.length; k++) {
            out = string.concat(out, _row(ns[k], _measure(ns[k])));
        }
        vm.writeFile("../results/solidity-local.md", out);
        console.log(out);
    }
}

//! Ed25519 attestation parsing and verification.

use ed25519_dalek::{Signature, VerifyingKey};

pub const PUBKEY_LEN: usize = 32;
pub const SIG_LEN: usize = 64;

/// `attestation = pubkey || signature`, exactly 96 bytes.
pub fn split(a: &[u8]) -> Option<([u8; PUBKEY_LEN], [u8; SIG_LEN])> {
    if a.len() != PUBKEY_LEN + SIG_LEN {
        return None;
    }
    let mut pk = [0u8; PUBKEY_LEN];
    let mut sig = [0u8; SIG_LEN];
    pk.copy_from_slice(&a[..PUBKEY_LEN]);
    sig.copy_from_slice(&a[PUBKEY_LEN..]);
    Some((pk, sig))
}

/// Strict RFC 8032 verification: rejects non-canonical S, small-order keys and
/// non-canonical point encodings.
pub fn verify(msg: &[u8; 32], pk: &[u8; PUBKEY_LEN], sig: &[u8; SIG_LEN]) -> bool {
    match VerifyingKey::from_bytes(pk) {
        Ok(key) => key.verify_strict(msg, &Signature::from_bytes(sig)).is_ok(),
        Err(_) => false,
    }
}

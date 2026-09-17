// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[10] calldata publicSignals
    ) external view returns (bool);
}

/// @title VouchRegistry — compliance without disclosure
/// @notice A verifier publishes POLICIES: "prove, against this issuer's key, that you are over
///         18 and hold at least this much". A holder proves it in their own browser and submits
///         only the proof. This contract checks that the proof's public signals are EXACTLY the
///         policy it claims to satisfy, verifies the pairing, burns the nullifier so the same
///         credential cannot be reused in this context, and records that the caller is cleared.
///
///         WHAT THIS CONTRACT STORES: a policy, a set of spent nullifiers, and a boolean per
///         address per policy. There is no date of birth, no balance, no country, no name, no
///         document hash, and no way to recover any of them from what is stored. The chain
///         learns that SOMEONE holding a credential from a named issuer satisfied a named
///         policy. It never learns which person, or by how much they satisfied it.
///
///         The nullifier is Poseidon(holderSecret, policyId) computed inside the circuit. Within
///         one policy it is stable, so a second use is refused. Across policies it is unlinkable,
///         so two verifiers comparing their registries cannot tell they share a user.
contract VouchRegistry is Ownable {
    /// @dev the order snarkjs emits the public signals in, fixed by circuits/vouch.circom
    uint256 private constant SIG_NULLIFIER = 0;
    uint256 private constant SIG_ISSUER_X = 1;
    uint256 private constant SIG_ISSUER_Y = 2;
    uint256 private constant SIG_NOW_DAYS = 3;
    uint256 private constant SIG_MIN_AGE = 4;
    uint256 private constant SIG_MIN_BALANCE = 5;
    uint256 private constant SIG_REQ_AGE = 6;
    uint256 private constant SIG_REQ_BALANCE = 7;
    uint256 private constant SIG_REQ_ACCREDITED = 8;
    uint256 private constant SIG_CONTEXT = 9;

    struct Policy {
        string name;
        uint256 issuerPubX; // the only issuer this policy will accept
        uint256 issuerPubY;
        uint64 minAgeDays;
        uint128 minBalance;
        bool requireAge;
        bool requireBalance;
        bool requireAccredited;
        uint32 maxClockSkewDays; // how stale the prover's clock may be
        bool active;
    }

    IGroth16Verifier public immutable verifier;

    mapping(uint256 policyId => Policy) private _policies;
    uint256 public policyCount;

    /// @notice nullifier => spent. The only trace a proof leaves, and it reveals nothing.
    mapping(uint256 nullifier => bool) public spent;
    /// @notice who is cleared for what. A boolean, never a value.
    mapping(address holder => mapping(uint256 policyId => bool)) public cleared;
    mapping(uint256 policyId => uint256) public clearedCount;

    event PolicyPublished(uint256 indexed policyId, string name, uint256 issuerPubX, uint256 issuerPubY);
    event PolicyRetired(uint256 indexed policyId);
    event Cleared(uint256 indexed policyId, address indexed holder, uint256 indexed nullifier);

    error NoSuchPolicy();
    error PolicyInactive();
    error WrongIssuer();
    error PolicyMismatch(string field);
    error ClockOutOfRange();
    error NullifierSpent();
    error ProofInvalid();
    error AlreadyCleared();

    constructor(address admin, IGroth16Verifier verifier_) Ownable(admin) {
        verifier = verifier_;
    }

    // ------------------------------------------------------------- policies
    function publishPolicy(Policy calldata p) external onlyOwner returns (uint256 policyId) {
        policyId = ++policyCount;
        _policies[policyId] = p;
        _policies[policyId].active = true;
        emit PolicyPublished(policyId, p.name, p.issuerPubX, p.issuerPubY);
    }

    function retirePolicy(uint256 policyId) external onlyOwner {
        if (_policies[policyId].issuerPubX == 0) revert NoSuchPolicy();
        _policies[policyId].active = false;
        emit PolicyRetired(policyId);
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    // ---------------------------------------------------------------- clear
    /// @notice Submit a proof that you satisfy `policyId`. Reverts unless the proof's public
    ///         signals ARE the policy, the clock is fresh, the nullifier is unspent and the
    ///         pairing check passes. Nothing about the holder is written down.
    function clear(
        uint256 policyId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[10] calldata pub
    ) external {
        Policy storage p = _policies[policyId];
        if (p.issuerPubX == 0) revert NoSuchPolicy();
        if (!p.active) revert PolicyInactive();
        if (cleared[msg.sender][policyId]) revert AlreadyCleared();

        // the proof must be FOR this policy, not merely a valid proof of something
        if (pub[SIG_CONTEXT] != policyId) revert PolicyMismatch("context");
        if (pub[SIG_ISSUER_X] != p.issuerPubX || pub[SIG_ISSUER_Y] != p.issuerPubY) revert WrongIssuer();
        if (pub[SIG_MIN_AGE] != p.minAgeDays) revert PolicyMismatch("minAgeDays");
        if (pub[SIG_MIN_BALANCE] != p.minBalance) revert PolicyMismatch("minBalance");
        if (pub[SIG_REQ_AGE] != (p.requireAge ? 1 : 0)) revert PolicyMismatch("requireAge");
        if (pub[SIG_REQ_BALANCE] != (p.requireBalance ? 1 : 0)) revert PolicyMismatch("requireBalance");
        if (pub[SIG_REQ_ACCREDITED] != (p.requireAccredited ? 1 : 0)) revert PolicyMismatch("requireAccredited");

        // the prover's clock must be recent and not in the future, or an expired credential
        // could be proven fresh forever
        uint256 today = block.timestamp / 86400;
        uint256 asserted = pub[SIG_NOW_DAYS];
        if (asserted > today || asserted + p.maxClockSkewDays < today) revert ClockOutOfRange();

        uint256 nullifier = pub[SIG_NULLIFIER];
        if (spent[nullifier]) revert NullifierSpent();

        if (!verifier.verifyProof(a, b, c, pub)) revert ProofInvalid();

        spent[nullifier] = true;
        cleared[msg.sender][policyId] = true;
        clearedCount[policyId] += 1;
        emit Cleared(policyId, msg.sender, nullifier);
    }

    /// @notice the gate a dapp calls: one SLOAD, no PII, no signature, no server
    function isCleared(address holder, uint256 policyId) external view returns (bool) {
        return cleared[holder][policyId];
    }
}

pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/smt/smtverifier.circom";

/*
 * EXPERIMENT — VOUCH plus revocation, to measure what revocation actually costs.
 *
 * Identical to vouch.circom, plus: the issuer publishes a sparse Merkle tree of revoked
 * credential ids. The holder proves EXCLUSION from that tree (fnc = 1), i.e. "my credential
 * is not on the revocation list", without revealing which credential is theirs.
 *
 * revocationRoot becomes a tenth public input. The verifier pins it to the issuer's latest
 * published root, so a holder cannot prove against a stale tree from before they were revoked.
 */
template VouchRev(nLevels) {
    signal input issuerPubX;
    signal input issuerPubY;
    signal input nowDays;
    signal input minAgeDays;
    signal input minBalance;
    signal input requireAge;
    signal input requireBalance;
    signal input requireAccredited;
    signal input contextId;
    signal input revocationRoot;      // NEW: the issuer's published revocation tree root

    signal input holderSecret;
    signal input dobDays;
    signal input balance;
    signal input countryCode;
    signal input flags;
    signal input expiresAt;
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;
    signal input credentialId;        // NEW: private; the leaf key in the revocation tree
    signal input revSiblings[nLevels];// NEW: the exclusion proof path
    signal input revOldKey;           // NEW: the nearest occupied leaf
    signal input revOldValue;
    signal input revIsOld0;

    signal output nullifier;

    requireAge * (requireAge - 1) === 0;
    requireBalance * (requireBalance - 1) === 0;
    requireAccredited * (requireAccredited - 1) === 0;

    component subject = Poseidon(1);
    subject.inputs[0] <== holderSecret;

    // credentialId is bound into the signature too, so it cannot be swapped for an unrevoked one
    component msg = Poseidon(7);
    msg.inputs[0] <== subject.out;
    msg.inputs[1] <== dobDays;
    msg.inputs[2] <== balance;
    msg.inputs[3] <== countryCode;
    msg.inputs[4] <== flags;
    msg.inputs[5] <== expiresAt;
    msg.inputs[6] <== credentialId;

    component sig = EdDSAPoseidonVerifier();
    sig.enabled <== 1;
    sig.Ax <== issuerPubX;
    sig.Ay <== issuerPubY;
    sig.R8x <== sigR8x;
    sig.R8y <== sigR8y;
    sig.S <== sigS;
    sig.M <== msg.out;

    component fresh = GreaterEqThan(64);
    fresh.in[0] <== expiresAt;
    fresh.in[1] <== nowDays;
    fresh.out === 1;

    component old_enough = GreaterEqThan(64);
    old_enough.in[0] <== nowDays - dobDays;
    old_enough.in[1] <== minAgeDays;
    requireAge * (1 - old_enough.out) === 0;

    component solvent = GreaterEqThan(128);
    solvent.in[0] <== balance;
    solvent.in[1] <== minBalance;
    requireBalance * (1 - solvent.out) === 0;

    component bits = Num2Bits(8);
    bits.in <== flags;
    requireAccredited * (1 - bits.out[0]) === 0;

    signal countryBound;
    countryBound <== countryCode * countryCode;

    // ---- NEW: prove credentialId is NOT in the revocation tree
    component notRevoked = SMTVerifier(nLevels);
    notRevoked.enabled <== 1;
    notRevoked.fnc <== 1;                 // 1 = exclusion proof
    notRevoked.root <== revocationRoot;
    for (var i = 0; i < nLevels; i++) { notRevoked.siblings[i] <== revSiblings[i]; }
    notRevoked.oldKey <== revOldKey;
    notRevoked.oldValue <== revOldValue;
    notRevoked.isOld0 <== revIsOld0;
    notRevoked.key <== credentialId;
    notRevoked.value <== 0;

    component nul = Poseidon(2);
    nul.inputs[0] <== holderSecret;
    nul.inputs[1] <== contextId;
    nullifier <== nul.out;
}

component main {
    public [issuerPubX, issuerPubY, nowDays, minAgeDays, minBalance,
            requireAge, requireBalance, requireAccredited, contextId, revocationRoot]
} = VouchRev(20);   // 2^20 = 1,048,576 revocable credentials

pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

/*
 * VOUCH, decentralized — no single issuer, and nobody learns which one vouched for you.
 *
 * The base circuit pins ONE issuer key as a public input, which means two things go wrong at
 * once: that issuer is a single point of coercion and breach, and every verifier learns which
 * institution you banked with. "Signed by Coutts" and "signed by a payday lender" are both
 * facts about you that the policy never asked for.
 *
 * Here the issuer key becomes PRIVATE. What is public instead is the root of a Merkle tree of
 * accredited issuers, maintained by whoever governs accreditation. The holder proves:
 *
 *     some issuer inside the accredited set signed this credential
 *
 * without revealing which. Trust is now spread across the whole set — compromising one issuer
 * forges credentials only for that issuer's own subjects, and the verifier's pinned root can
 * drop them by publishing a new root. The verifier's guarantee is unchanged; their knowledge
 * about you shrinks.
 */

/// One level of a Merkle path: swap the pair if we are the right child, then hash.
template MerkleLevel() {
    signal input a;            // the running hash
    signal input sibling;
    signal input isRight;      // 1 if `a` is the RIGHT child at this level
    signal output out;

    isRight * (isRight - 1) === 0;          // must be a bit, or the path is forgeable

    // left  = isRight ? sibling : a
    // right = isRight ? a       : sibling
    signal diff;
    diff <== sibling - a;
    signal left;
    signal right;
    left  <== a + isRight * diff;
    right <== sibling - isRight * diff;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

/// Prove `leaf` sits in the tree with the given root.
template MerkleInclusion(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component lvl[depth];
    signal running[depth + 1];
    running[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        lvl[i] = MerkleLevel();
        lvl[i].a <== running[i];
        lvl[i].sibling <== pathElements[i];
        lvl[i].isRight <== pathIndices[i];
        running[i + 1] <== lvl[i].out;
    }
    root === running[depth];
}

template VouchShard(depth) {
    // ------------------------------------------------------------------ public
    signal input issuerSetRoot;       // the accredited-issuer set, NOT one issuer
    signal input nowDays;
    signal input minAgeDays;
    signal input minBalance;
    signal input requireAge;
    signal input requireBalance;
    signal input requireAccredited;
    signal input contextId;

    // ------------------------------------------------------------------ private
    signal input issuerPubX;          // WAS PUBLIC. Now nobody learns who vouched for you.
    signal input issuerPubY;
    signal input issuerPath[depth];   // proof that this issuer is accredited
    signal input issuerIndices[depth];

    signal input holderSecret;
    signal input dobDays;
    signal input balance;
    signal input countryCode;
    signal input flags;
    signal input expiresAt;
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;

    signal output nullifier;

    requireAge * (requireAge - 1) === 0;
    requireBalance * (requireBalance - 1) === 0;
    requireAccredited * (requireAccredited - 1) === 0;

    // ---- the issuer is a member of the accredited set (this replaces trusting one key)
    component issuerLeaf = Poseidon(2);
    issuerLeaf.inputs[0] <== issuerPubX;
    issuerLeaf.inputs[1] <== issuerPubY;

    component accredited = MerkleInclusion(depth);
    accredited.leaf <== issuerLeaf.out;
    accredited.root <== issuerSetRoot;
    for (var i = 0; i < depth; i++) {
        accredited.pathElements[i] <== issuerPath[i];
        accredited.pathIndices[i] <== issuerIndices[i];
    }

    // ---- everything below is the base circuit, unchanged
    component subject = Poseidon(1);
    subject.inputs[0] <== holderSecret;

    component msg = Poseidon(6);
    msg.inputs[0] <== subject.out;
    msg.inputs[1] <== dobDays;
    msg.inputs[2] <== balance;
    msg.inputs[3] <== countryCode;
    msg.inputs[4] <== flags;
    msg.inputs[5] <== expiresAt;

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

    component nul = Poseidon(2);
    nul.inputs[0] <== holderSecret;
    nul.inputs[1] <== contextId;
    nullifier <== nul.out;
}

component main {
    public [issuerSetRoot, nowDays, minAgeDays, minBalance,
            requireAge, requireBalance, requireAccredited, contextId]
} = VouchShard(8);   // 2^8 = 256 accredited issuers

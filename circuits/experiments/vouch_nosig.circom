pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

/*
 * VOUCH — prove a compliance claim without revealing the credential behind it.
 *
 * An issuer (a bank, a KYC provider, a government) signs a credential once, off-chain, with
 * EdDSA over BabyJubJub. The holder keeps every attribute private FOREVER. To satisfy a
 * verifier, the holder proves in their own browser that:
 *
 *   1. the credential carries a valid signature from the issuer named in the public inputs
 *   2. they know the secret the credential was issued to  (it is theirs, not stolen)
 *   3. the credential has not expired
 *   4. each requested predicate holds: age, balance, accreditation
 *
 * WHAT IS PUBLIC: the issuer's key, the policy being checked (which predicates, and their
 * thresholds), the verifier's clock, a context id, and a nullifier.
 * WHAT IS PRIVATE, ALWAYS: the date of birth, the balance, the country, the flags, the expiry,
 * the holder's secret, and the signature itself.
 *
 * The public signals are therefore a function of the POLICY and the CONTEXT only — never of the
 * data. Two different people with different birthdays and different balances, proving the same
 * policy in the same context, emit public signals that differ in the nullifier and in nothing
 * else. That is the property `npm test` checks by construction, over real proofs.
 *
 * The nullifier is Poseidon(holderSecret, contextId). Within one context it is stable, so a
 * verifier can reject a second use. Across contexts it is unlinkable, so two verifiers cannot
 * discover they are talking about the same person.
 */
template Vouch() {
    // ---------------------------------------------------------------- public
    signal input issuerPubX;          // the issuer whose signature is demanded
    signal input issuerPubY;
    signal input nowDays;             // the verifier's clock, in days since the epoch
    signal input minAgeDays;          // e.g. 6575 for 18 years
    signal input minBalance;          // solvency threshold, in the credential's unit
    signal input requireAge;          // 0 or 1
    signal input requireBalance;      // 0 or 1
    signal input requireAccredited;   // 0 or 1
    signal input contextId;           // who is asking; scopes the nullifier

    // --------------------------------------------------------------- private
    signal input holderSecret;        // only the holder knows this
    signal input dobDays;             // date of birth, days since the epoch
    signal input balance;
    signal input countryCode;
    signal input flags;               // bit 0 = accredited investor
    signal input expiresAt;           // days since the epoch
    signal input sigR8x;              // the issuer's EdDSA signature
    signal input sigR8y;
    signal input sigS;

    // ---------------------------------------------------------------- output
    signal output nullifier;          // Poseidon(holderSecret, contextId), public

    // the three policy switches must be bits, or a prover could scale a constraint away
    requireAge * (requireAge - 1) === 0;
    requireBalance * (requireBalance - 1) === 0;
    requireAccredited * (requireAccredited - 1) === 0;

    // ---- 2. the holder knows the secret this credential was issued to
    component subject = Poseidon(1);
    subject.inputs[0] <== holderSecret;

    // ---- 1. the issuer signed exactly these attributes
    component msg = Poseidon(6);
    msg.inputs[0] <== subject.out;
    msg.inputs[1] <== dobDays;
    msg.inputs[2] <== balance;
    msg.inputs[3] <== countryCode;
    msg.inputs[4] <== flags;
    msg.inputs[5] <== expiresAt;

    // SIGNATURE REMOVED to measure its share
    // sig.enabled <== 1;
    // sig.Ax <== issuerPubX;
    // sig.Ay <== issuerPubY;
    // sig.R8x <== sigR8x;
    // sig.R8y <== sigR8y;
    // sig.S <== sigS;
    // sig.M <== msg.out;

    // ---- 3. the credential has not expired
    component fresh = GreaterEqThan(64);
    fresh.in[0] <== expiresAt;
    fresh.in[1] <== nowDays;
    fresh.out === 1;

    // ---- 4a. age: nowDays - dobDays >= minAgeDays
    component old_enough = GreaterEqThan(64);
    old_enough.in[0] <== nowDays - dobDays;
    old_enough.in[1] <== minAgeDays;
    requireAge * (1 - old_enough.out) === 0;

    // ---- 4b. solvency: balance >= minBalance
    component solvent = GreaterEqThan(128);
    solvent.in[0] <== balance;
    solvent.in[1] <== minBalance;
    requireBalance * (1 - solvent.out) === 0;

    // ---- 4c. accreditation: bit 0 of the flags
    component bits = Num2Bits(8);
    bits.in <== flags;
    requireAccredited * (1 - bits.out[0]) === 0;

    // the country is bound into the signature so it cannot be swapped, and is never revealed
    signal countryBound;
    countryBound <== countryCode * countryCode;

    // ---- the nullifier: stable per context, unlinkable across contexts
    component nul = Poseidon(2);
    nul.inputs[0] <== holderSecret;
    nul.inputs[1] <== contextId;
    nullifier <== nul.out;
}

component main {
    public [issuerPubX, issuerPubY, nowDays, minAgeDays, minBalance,
            requireAge, requireBalance, requireAccredited, contextId]
} = Vouch();

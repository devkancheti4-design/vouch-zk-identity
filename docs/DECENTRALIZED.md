# Sharding VOUCH: no single issuer, no single copy of you

Two things in the base design are single points. Both are now sharded, both are measured, and
both are tested. Nothing below is a proposal — it compiles, proves and verifies today.

---

## 1. The issuer was one key, and it was public

`issuerPubX` and `issuerPubY` were **public signals**. That is two separate problems wearing one
coat:

- **Trust.** The registry comment said it plainly: *"the only issuer this policy will accept."*
  One key. Breach it or coerce its holder and every claim under that policy is forgeable.
- **Privacy.** Every verifier learned *which institution* vouched for you. "Signed by Coutts" and
  "signed by a payday lender" are both facts about you that no policy ever asked for. The circuit
  was hiding your balance and broadcasting your bank.

### What replaces it

`circuits/experiments/vouch_shard.circom` makes the issuer key **private** and publishes a
**Merkle root of accredited issuers** instead. The holder proves:

> some issuer inside the accredited set signed this credential

without revealing which. An accreditation body maintains the set; a verifier pins the root of
whichever body it trusts.

| | Base | Sharded |
|---|---|---|
| Constraints | 10,273 | **14,958** (+46%) |
| Proving time | 432 ms | **496 ms** (+15%) |
| zkey | 5.2 MB | 6.8 MB |
| **Public inputs** | 9 | **8** |
| Issuer identity | **public** | **private** |
| Issuers trusted | 1 | up to 256 (depth 8) |

Note the direction of the last three rows. Decentralising here does not trade privacy for
robustness — the verifier ends up knowing **strictly less** while trusting **strictly more
broadly**, for 15% more proving time.

### Tested — `circuits/experiments/shard.test.mjs`, 5/5

- a credential from **any** of five accredited issuers proves
- three different banks sign, and the public output is **byte-identical** — the verifier cannot
  tell them apart, and no issuer's key appears in any public signal
- a rogue issuer with a **perfectly valid signature** cannot prove: it fails set membership
- **de-accreditation works**: drop an issuer, the root moves, and everything they signed stops
  proving against the new root — this is issuer-level revocation, which the base design had no
  mechanism for at all
- the root stays public, so a verifier still pins exactly which accreditation body it trusts

### What it does not fix

Trust is spread, not eliminated. Compromising one accredited issuer still forges credentials —
for that issuer's own subjects only, and the set can drop them. True k-of-n attestation (several
issuers must independently sign) would need k EdDSA checks in-circuit, roughly +8,086 constraints
each; that is a bigger change and is not built.

---

## 2. The holder's secret was one blob in one browser

The wallet backup file holds the whole identity. Lose it and the credential is unrecoverable;
copy it and you **are** that person. Those are the same defect: the secret exists in exactly one
place at a time.

`frontend/src/lib/shards.ts` implements **Shamir secret sharing over the BN254 scalar field**, so
a reconstructed secret is always a field element the circuit can consume. Split into *n* shards,
any *k* reconstruct.

Hold them apart — phone, laptop, a friend, a safe. Losing one costs nothing. **Stealing one gains
nothing**, and that is not a hand-wave: with fewer than *k* shards, every candidate secret remains
exactly as consistent with what you hold. Not "computationally hard" — *information-theoretically
independent*. This is why it beats chopping a file into *n* pieces, where every piece leaks its
own bytes.

### Tested — `frontend/test/shards.test.mjs`, 11/11

- **all ten** 3-of-5 subsets reconstruct, not just a convenient one
- fewer than *k* are refused, not silently wrong
- duplicating one shard does not manufacture a quorum
- **the secrecy claim itself**: interpolate *k*−1 shards against five different candidate secrets
  and each implies a different missing shard — so two shards rule none of them out
- shards from different secrets cannot be mixed
- a shard file never contains the secret, and is useless alone
- splitting twice gives different shards for the same secret

### The honest trade

Sharding fixes loss and raises the bar on theft. It does **not** give device binding: gather *k*
shards and you are the holder, so an adult can still deliberately hand over *k* shards to a minor.
The fix for deliberate lending is hardware binding via WebAuthn PRF, measured separately in
[WORTH.md](WORTH.md) at about a day's work and zero circuit changes. Sharding and binding solve
different halves; a real deployment wants both.

---

## Where this leaves the three stores

| Store | Before | After |
|---|---|---|
| Browser | whole secret, one blob | one shard of *k*-of-*n* |
| Issuer | one key, publicly named on every proof | one of up to 256, never named |
| Chain | policy pins one issuer key | policy pins an accreditation root |

Still unsharded, and honestly so: the **trusted setup**, which remains a single ceremony — though
a verified 3-contributor ceremony takes 14 seconds, measured in [WORTH.md](WORTH.md).

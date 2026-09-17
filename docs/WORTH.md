# Is VOUCH a real-world use case, and what is it worth?

Everything below was measured on 2026-09-18, on this machine (12 cores, 16 GB, Chrome 152),
against the real circuit and the real chain. No estimates unless labelled as such.

---

## 1. The problem is real, and it is currently forced

This is not a speculative market. Three things are live right now:

- **UK Online Safety Act** — the children's safety duties carrying the "highly effective age
  assurance" requirement took effect 25 July 2025. Services hosting pornographic content must
  verify age.
- **US state law** — age-verification statutes expanded sharply through 2025, moving beyond adult
  content into social media and account creation.
- **eIDAS 2.0 / EUDI Wallet** — the EU reference wallet is being built with proof-of-age as a
  cornerstone, including a zero-knowledge subcomponent applied to passport and national-ID data.

So the demand is regulatory, not optional, and the buyer is every consumer site in three
jurisdictions. That is about as real as a use case gets.

**But the problem being real does not mean this implementation captures it.** Those are separate
questions and section 5 answers the second one.

---

## 2. What we measured

| Measurement | Result | How |
|---|---|---|
| Circuit size | 10,273 constraints | `snarkjs r1cs info` |
| Private inputs | 9 | circuit shape check |
| Public signals | 10 | asserted in 22 ZK tests |
| Proof generation, warm | **median 358 ms**, p90 365 ms, n=12 | `groth16.fullProve` in-page |
| Proof generation, cold | 600 ms | first call, incl. WASM instantiation |
| Proof verification, off-chain | **8.7 ms** median, n=20 | `groth16.verify` in-page |
| Proof size | 724 bytes | serialized |
| Verification key | 4.1 KB | what a verifier needs, total |
| On-chain verification | **381,755 gas** | `gasleft()` around `clear()` |
| Artifacts the holder downloads | 9.41 MB raw / **3.93 MB gzipped** | measured, server sends gzip |

Proof time is tight (347–409 ms across 12 runs) because the work is fixed: 10k constraints is a
small circuit. That number is a **best case** — a 12-core laptop. A mid-range phone is materially
slower, and we did not measure one. Treat mobile as unmeasured, not as fast.

### The cold start is the real UX cost

Time before a first-time user can prove anything, gated by the 3.93 MB download:

| Connection | Time to first proof |
|---|---|
| Fibre 100 Mbps | 0.3 s |
| Broadband 50 Mbps | 0.7 s |
| Good 4G 25 Mbps | 1.3 s |
| Typical 4G 10 Mbps | 3.3 s |
| Congested 4G 4 Mbps | 8.2 s |
| 3G 1.5 Mbps | 22.0 s |

On a good connection this is a non-issue. On a bad one it is the whole experience.

### On-chain cost, in money

At ETH $3,000:

| Network | Per verification | Per 1M verifications |
|---|---|---|
| Ethereum L1 (40 gwei) | $45.81 | $45,810,600 |
| Ethereum L1 (8 gwei) | $9.16 | $9,162,120 |
| Base / OP mainnet | $0.0092 | $9,162 |
| Arbitrum One | $0.0137 | $13,743 |
| Polygon PoS | $0.0103 | $10,307 |

**Conclusion: this is an L2 product or it is nothing.** On L1 a single age check costs more than the
bottle of whisky it gates.

---

## 3. Tested against the strongest public critique

In August 2026 the EFF published *"Zero-Knowledge Proofs Aren't Age Verification Silver Bullets."*
It is the best argument against this entire category. Here is VOUCH against each objection, checked
rather than asserted.

| EFF objection | Does it apply to VOUCH? | Evidence |
|---|---|---|
| **The issuer tracks every credential use**, building a metadata trail | **No.** The issuer signs once and is never contacted again. Proving is local; the issuer has no channel to observe it. | `server/src/index.mjs` has one endpoint that signs. No verification endpoint exists. |
| **Tokens can be replayed** — a researcher bypassed a live scheme with a Chrome extension that reused one "over-18" token | **No.** The nullifier is burned on first use. | `test_TheSameNullifierCannotBeUsedTwice`, plus `spent[nullifier]` in `VouchRegistry.sol:135` |
| **Centralized issuer = single point of failure / coercion target** | **Yes, fully.** One issuer key per policy. A coerced or breached issuer forges any claim. | `policies[].issuerPubX/Y` is a single key |
| **Coverage** — people without ID are excluded | **Yes, fully.** No credential, no access. | unaddressed by design |
| **Doesn't solve the underlying policy question** | **Yes.** This is a mechanism, not a position on whether age-gating the internet is wise. | out of scope |

Two of five genuinely do not apply, and they are the two that are *architectural* rather than
political. The no-phone-home property is the strongest thing VOUCH has, and it is real: there is no
code path by which the issuer learns a proof happened.

---

## 4. What we found that the ZK claim does not cover

### 4.1 The chain links claims that the circuit worked hard to unlink — demonstrated

The circuit's nullifier is unlinkable across contexts, and the tests prove it. The **deployment
defeats that anyway**. Querying the live registry for `Cleared` events:

```
address 0x70997970c51812dc3a010c7d01b50e0d17dc79c8
  policies cleared: 1, 2, 3
    policy 1  nullifier 14992545762035118727…
    policy 2  nullifier 15144973571964749247…
    policy 3  nullifier 91178473299918362532…
```

Three different nullifiers — the circuit did its job. But `Cleared(policyId, holder, nullifier)`
publishes `msg.sender`, so an observer reads straight off the chain that **one address is
simultaneously over-18, accredited, and solvent over 10k**. The values stay hidden. The correlation
does not. And the moment that address touches a KYC'd exchange or an ENS name, the whole set
deanonymizes.

This is not a circuit bug. It is a layer the zero-knowledge claim never covered, and the README did
not previously say so. The fix is a fresh address per policy, or dropping the on-chain step for
verifiers that do not need it (see 4.3).

### 4.2 A credential is a bearer token — there is no device binding

The circuit proves knowledge of `holderSecret`. It does not prove *who* knows it. Anyone holding the
secret and the credential is indistinguishable from the holder. There is no device binding, no
biometric, no secure-enclave attestation.

For age verification specifically, this is the dominant real-world failure mode: a minor borrows an
adult's wallet. VOUCH cannot detect it, and the ZK property actively protects the borrower.

**The backup file added on 2026-09-18 makes this materially easier** — it is a single portable file
containing both secret and credential. It is the correct fix for data loss and it is a lending
kit. Both statements are true. The wallet page says so in plain language, which is the most that can
be done without device binding.

### 4.3 The chain may not be needed at all

Off-chain verification is **8.7 ms** against a **4.1 KB** verification key. A website checking
"is this person over 18" needs no chain: it needs 4 KB of static config and 9 ms of CPU.

The chain buys exactly one thing — a *shared* nullifier set, so a credential cannot be reused across
independent verifiers. That matters for one-per-person allocations. It is worth nothing for an age
gate, where the cost is $0.01, seconds of latency, and the linkage leak in 4.1.

**The most defensible version of this product uses no blockchain for most of its use cases.**

### 4.4 The trusted setup is a total break, not a caveat

The ceremony is one contributor with fixed entropy, chosen so artifacts are reproducible. Anyone who
reconstructs that toxic waste can forge a proof of **any** claim, undetectably. Production requires a
multi-party ceremony. Until then, every soundness claim holds only against an adversary who does not
have the setup — which, since it is reproducible from the repo, is nobody.

This is disclosed in the README. It is worth restating that it invalidates soundness in production,
not merely "needs hardening."

### 4.5 No revocation

Expiry only. Real credentials get revoked — fraud, death, changed status. Needs a Merkle
non-membership proof or an accumulator in the same circuit. Not present.

### 4.6 No interoperability

The credential is a bespoke Poseidon hash over five fields. It is not a W3C Verifiable Credential,
not SD-JWT, not ISO 18013-5 mdoc. **No real issuer — no bank, no government — will sign this
format.** That is the single largest commercial gap, and it is not a coding problem.

---

## 5. What it is worth, fairly

Separate the three things being valued.

**The idea: worth a great deal, and already claimed.** Groth16 + EdDSA-on-BabyJubJub + Poseidon +
nullifiers is the canonical ZK-credential design. Privado ID has shipped it since 2022. ZKPassport
runs it in production today against real passport chips. The EUDI wallet is building it into EU law.
VOUCH did not invent this and does not need to — but it means the architecture is *validation*, not
differentiation.

**The implementation: a clean, honest, correct instance of a known pattern.** 109 lines of circom,
129 lines of registry Solidity, ~2,000 lines of frontend, 439 lines of tests. 42 tests across three
layers, all passing. The measurements above are real. For a hackathon artifact this is strong work:
the circuit is right, the tests are adversarial rather than confirmatory, and the ZK property is
demonstrated by information-flow argument rather than claimed. What it is *not* is novel.

**The product: close to zero, and the reason is not technical.** The hard parts of this market are
an accredited issuer willing to sign, a credential format regulators accept, a multi-party ceremony,
device binding, revocation, and certification. VOUCH has none of them, and none is a weekend of
code. ZKPassport's moat is reading passport NFC chips and being trusted to; the circuit is the easy
part. Realistically the gap to something a regulator would accept is 12–18 months and a compliance
team, not an engineer.

### Score, if you want one

| Dimension | Score | Why |
|---|---|---|
| Problem is real | 10/10 | regulatory, forced, three jurisdictions |
| Approach is correct | 9/10 | canonical design, correctly implemented |
| Cryptographic execution | 8/10 | right primitives, real tests; setup is a demo ceremony |
| Measured performance | 8/10 | 358 ms proving, 9 ms verify; 3.9 MB cold start hurts |
| Honesty of claims | 9/10 | tests are adversarial; §4.1 was found by looking, not by being told |
| Production readiness | **2/10** | no MPC ceremony, no revocation, no device binding, no interop |
| Commercial differentiation | **2/10** | the pattern is shipped by three funded competitors |

**As a hackathon submission judged on the stated brief — verify ZK properties, measure proving
speed, evaluate gas, review issuance UX — this scores well, because all four are measured and two
of them surfaced genuine problems.** As a business it is a demo of someone else's architecture.

### The single most valuable thing to say when presenting

Not "we built private age verification." Say:

> We built it, measured it, and then found where it leaks. The circuit is zero-knowledge and the
> tests prove it — but we queried our own chain and found that `msg.sender` re-links the three
> claims the nullifiers were designed to keep apart. The cryptography was never the weak layer.
> The deployment was.

A judge will remember that far longer than a green checkmark.

---

## Sources

- IEEE SA — *Trends in Online Age Verification for 2026* — https://standards.ieee.org/beyond-standards/trends-in-online-age-verification-for-2026/
- EFF — *Zero-Knowledge Proofs Aren't Age Verification Silver Bullets* (Aug 2026) — https://www.eff.org/deeplinks/2026/08/zkps-arent-age-verification-silver-bullets
- Aztec Labs — *The State of Age Verification in 2026* — https://aztec-labs.com/blog/age-verification-state-2026.html
- National Law Review — *Age-Verification Laws Reshape Online Compliance in 2026* — https://natlawreview.com/article/new-age-verification-reality-compliance-rapidly-expanding-state-regulatory

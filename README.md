# VOUCH — prove you qualify, show them nothing

Every age check today works the same way: to prove one fact you hand over a document that reveals
fifty. Your birthday, your address, your photo, your document number, all of it, to a shop that
only needed to know you are over 18.

VOUCH replaces the document with a proof. A bank or KYC provider signs your attributes once. After
that your browser can prove any single claim about them — old enough, solvent enough, accredited —
to anyone, forever, without the claim's subject ever leaving your device.

```
ISSUER (a server)          HOLDER (a browser)            VERIFIER (a chain)
Node + circomlibjs   ──▶   TypeScript + snarkjs   ──▶    Solidity, snarkjs-generated
holds the signing key      holds credential+secret       checks the pairing
knows your details         builds every proof            knows nothing about you
       └── credential ─────────┘        └── proof only ──────────┘
```

The issuer is never contacted again after issuance. It cannot see which verifier you visit, or
when, so it cannot build a profile even if it wanted to.

## What is in the box

| path | what |
|---|---|
| `circuits/` | `vouch.circom` — the whole zero-knowledge statement in 166 lines. EdDSA signature check, holder binding, expiry, three predicates, nullifier. `build.sh` runs the Groth16 setup and exports the Solidity verifier; `test/zk.test.mjs` is the 22-test audit |
| `server/` | the issuer API. Holds the signing key, runs the identity check, signs six attributes. The user never sees the key |
| `contracts/` | `VouchRegistry.sol` — publishes policies, binds each proof to one, burns the nullifier, stores one boolean. Plus the generated `Groth16Verifier.sol` and 10 tests driven by a real proof |
| `frontend/` | the product: a wallet, three storefronts that each demand a different claim, a live leak audit, and an architecture page with measured charts |
| `verify.sh` | one command that runs every check |

## Run it

```bash
cd circuits && npm install && npm run build     # once: compile + local Groth16 ceremony
```

```bash
cd contracts && npm run node                    # terminal 1 — chain on :8549
cd contracts && npm run deploy:local            # terminal 2 — verifier, registry, 3 policies
cd server && npm start                          # terminal 3 — issuer API on :4000
cd frontend && npm run dev -- --port 5176       # terminal 4 — the site on :5176
```

Then: **Get verified** (the server signs your credential) → **Where it's used** (a shop demands a
claim; your browser proves it and the chain verifies it) → **What leaks?** (the honest test).

## Deploy it

The app is Vercel-ready. The frontend is a static Vite build, the issuer runs as serverless
functions under `frontend/api/`, and the circuit artifacts are committed so the browser can prove.

```bash
cd frontend && vercel deploy --prod --scope <your-team>
```

That gives you a working public site immediately: credential issuance, in-browser proving,
client-side verification, and the full 21-check validation suite. The header will read
**"verification: client-side only"**, which is honest — no registry is configured yet.

To light up the on-chain half, deploy the contracts to a public testnet and set three
environment variables in the Vercel project:

| variable | example |
|---|---|
| `VITE_RPC_URL` | `https://sepolia.base.org` |
| `VITE_REGISTRY` | the `VouchRegistry` address from your deploy |
| `VITE_CHAIN_ID` | `84532` |

Optionally set `ISSUER_SECRET` to control the signing key (it defaults to a fixed demo label, which
is reproducible and therefore not secret). In production that key belongs in a KMS, not an
environment variable.

**On a public deployment VOUCH holds no keys.** Locally it signs with the Hardhat dev accounts;
deployed, it asks the visitor's own wallet to submit the proof.

## The numbers, all measured

| | |
|---|---|
| circuit | 10,273 constraints · **9 private inputs** · 9 public · 1 output |
| proving, in the browser | ~553 ms · 5.2 MB proving key · 256-byte proof |
| local verify before sending | ~8 ms |
| on-chain `clear()` | ~357,000 gas including the pairing check |
| tests | 22 zero-knowledge audit + 10 registry = **32 passing** |
| where the constraints go | EdDSA 8,086 (79%) · Poseidon 1,899 · range checks 271 · logic 17 |

The headline from that last row: proving **who vouched for you** costs four fifths of the circuit,
while the compliance logic everyone talks about is 2.6% of it. Privacy is nearly free. Trust is
what you pay for.

## The claim that matters, and how it is settled

"No private data reaches the public signals" is easy to assert and easy to fake. It is settled here
with an information-flow argument: **if a private value could be recovered from the public signals,
then changing it would have to change one of them.** So the audit proves the same claim from
wildly different private data and compares the output byte for byte.

```
born 1990 · reserves 250,000 · UK        ─┐
born 1961 · reserves 250,000 · UK         │  byte-identical
born 1990 · reserves 9,999,999 · UK       │  public signals
born 1990 · reserves 250,000 · Germany   ─┘
a different person entirely              ─── only the nullifier moves
```

Run it yourself in the app under **What leaks?**, or from the terminal:

```bash
cd circuits && node --test test/zk.test.mjs
```

The suite also proves: a false claim is **unprovable**, not merely rejected (underage, insolvent,
unaccredited and expired credentials all fail to produce a proof at all); a stolen credential is
useless without the holder's secret; altering an attribute after issuance breaks the signature; a
rogue issuer cannot impersonate the real one; the nullifier is stable within one verifier and
unlinkable across two; and the proof is randomised, so proving twice does not produce the same bytes.

## Where the data lives

Three stores, and only one of them ever holds an attribute.

| Store | Holds | Lifetime |
|---|---|---|
| The holder's browser | the secret, and the credential in full | until site data is cleared |
| The issuer | that it issued to a subject commitment, and when | its own records |
| The chain | a spent-nullifier bit, and one boolean per address per policy | permanent |

The attributes a user types — date of birth, balance, country, accreditation — are written to
`localStorage` on their own machine and are never transmitted. The issuer signs them and forgets
them; it retains a commitment, not the values behind it. The chain never sees them at all: what it
records is that *some* holder satisfied policy *n*, which is the whole point.

The wallet is a single record under one key, written in one call. It used to be two keys written
minutes apart — the secret on first load, the credential after issuance — so a browser that evicted
one and kept the other (Safari caps script-written storage at seven days) left behind a credential
that could never be proven again. `frontend/test/wallet.test.mjs` covers that migration and nine
other ways the store can go wrong: corrupt JSON, a non-numeric secret, a half-written credential, an
orphaned credential, a blocked `localStorage` in private mode, and an export/import round-trip.

Because there is no server-side copy, there is no server-side recovery. The backup file on the
wallet page is the recovery path and the holder keeps it. It carries the secret in the clear, so it
is exactly as sensitive as the credential — that is the honest cost of no one else holding your data.

## What it does not do

The trusted setup is a local one-contributor ceremony with fixed entropy so the artifacts are
reproducible. Production needs a multi-party ceremony over the same circuit. Revocation is by
credential expiry only; a revocation list would be a Merkle non-membership proof in the same
circuit. The issuer is still trusted to attest truthfully — zero-knowledge hides the data, it does
not make a lying issuer honest.

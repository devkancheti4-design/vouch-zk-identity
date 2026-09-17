/**
 * VOUCH — the issuer API.
 *
 * This is the piece a bank, a government or a KYC provider actually runs. It holds the signing
 * key, which the user NEVER sees, performs whatever identity check the real world demands, and
 * hands back a credential signed over the applicant's attributes.
 *
 * After this call the server has done its job for good. It is not consulted when the holder
 * proves something later, it cannot see which shop they visit, and it cannot link their visits.
 * That is the difference between this and "sign in with your bank".
 */
import express from "express";
import cors from "cors";
import { createHash } from "node:crypto";
import { buildEddsa, buildPoseidon } from "circomlibjs";

const PORT = process.env.PORT ?? 4000;
const ISSUER_LABEL = process.env.ISSUER_LABEL ?? "Demo KYC Provider";

const eddsa = await buildEddsa();
const poseidon = await buildPoseidon();
const F = poseidon.F;

/** In production this is an HSM. Here it is derived from a label so the demo is reproducible. */
const PRIV = createHash("sha256").update(ISSUER_LABEL).digest();
const [Ax, Ay] = eddsa.prv2pub(PRIV);
const PUB = { x: F.toObject(Ax).toString(), y: F.toObject(Ay).toString() };

const toDays = (iso) => Math.floor(new Date(iso).getTime() / 86400000);
const today = () => Math.floor(Date.now() / 86400000);

const app = express();
app.use(cors());
app.use(express.json());

const issuedLog = [];

app.get("/api/issuer", (_req, res) => {
  res.json({ name: ISSUER_LABEL, pubX: PUB.x, pubY: PUB.y, issuedCount: issuedLog.length });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, issuer: ISSUER_LABEL }));

/**
 * POST /api/issue
 * body: { holderCommitment, dob, balance, countryCode, accredited, validDays }
 *
 * `holderCommitment` is Poseidon(secret) computed in the browser. The server never learns the
 * secret, so it cannot later impersonate the holder, and the credential is useless to a thief.
 */
app.post("/api/issue", (req, res) => {
  try {
    const { holderCommitment, dob, balance, countryCode, accredited, validDays } = req.body ?? {};
    if (!holderCommitment) return res.status(400).json({ error: "holderCommitment is required" });
    if (!dob || Number.isNaN(Date.parse(dob))) return res.status(400).json({ error: "dob must be an ISO date" });
    const bal = Number(balance);
    if (!Number.isFinite(bal) || bal < 0) return res.status(400).json({ error: "balance must be a non-negative number" });

    // --- this is where a real issuer runs its KYC: document scan, liveness, bank connection.
    // The outcome is a set of attested attributes; the process itself is out of scope here.
    const attrs = {
      dobDays: toDays(dob),
      balance: Math.floor(bal),
      countryCode: Number(countryCode) || 0,
      flags: accredited ? 1 : 0,
      expiresAt: today() + (Number(validDays) || 365),
    };

    const subject = BigInt(holderCommitment);
    const msg = poseidon([subject, BigInt(attrs.dobDays), BigInt(attrs.balance), BigInt(attrs.countryCode), BigInt(attrs.flags), BigInt(attrs.expiresAt)]);
    const sig = eddsa.signPoseidon(PRIV, msg);
    if (!eddsa.verifyPoseidon(msg, sig, [Ax, Ay])) throw new Error("issuer produced an invalid signature");

    const credential = {
      ...attrs,
      issuerName: ISSUER_LABEL,
      issuerPubX: PUB.x,
      issuerPubY: PUB.y,
      subject: subject.toString(),
      msg: F.toObject(msg).toString(),
      sigR8x: F.toObject(sig.R8[0]).toString(),
      sigR8y: F.toObject(sig.R8[1]).toString(),
      sigS: sig.S.toString(),
      issuedAt: new Date().toISOString(),
    };

    // the issuer keeps a record that it issued SOMETHING to a commitment. Not the attributes,
    // and nothing that lets it follow the holder around afterwards.
    issuedLog.push({ subject: credential.subject.slice(0, 12) + "…", at: credential.issuedAt });
    res.json({ credential });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`VOUCH issuer API on http://localhost:${PORT}`);
  console.log(`  issuer: ${ISSUER_LABEL}`);
  console.log(`  pubkey: ${PUB.x.slice(0, 24)}…`);
});

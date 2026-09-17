import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ISSUER_LABEL, cors, issuer, today, toDays } from "./_issuer";

/**
 * POST /api/issue — the only thing the issuer ever does.
 *
 * `holderCommitment` is Poseidon(secret), computed in the browser. The server never learns the
 * secret, so it cannot impersonate the holder and a stolen credential is useless. After this
 * call the issuer is out of the picture: it is not consulted when the holder proves something,
 * it cannot see which verifier they visit, and it cannot link their visits.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { holderCommitment, dob, balance, countryCode, accredited, validDays } = req.body ?? {};
    if (!holderCommitment) return res.status(400).json({ error: "holderCommitment is required" });
    if (!dob || Number.isNaN(Date.parse(dob))) return res.status(400).json({ error: "dob must be an ISO date" });
    const bal = Number(balance);
    if (!Number.isFinite(bal) || bal < 0) return res.status(400).json({ error: "balance must be a non-negative number" });

    // --- a real issuer runs its KYC here: document scan, liveness, open banking.
    const attrs = {
      dobDays: toDays(dob),
      balance: Math.floor(bal),
      countryCode: Number(countryCode) || 0,
      flags: accredited ? 1 : 0,
      expiresAt: today() + (Number(validDays) || 365),
    };

    const { eddsa, poseidon, F, priv, pub } = await issuer();
    const subject = BigInt(holderCommitment);
    const msg = poseidon([subject, BigInt(attrs.dobDays), BigInt(attrs.balance), BigInt(attrs.countryCode), BigInt(attrs.flags), BigInt(attrs.expiresAt)]);
    const sig = eddsa.signPoseidon(priv, msg);

    res.status(200).json({
      credential: {
        ...attrs,
        issuerName: ISSUER_LABEL,
        issuerPubX: pub.x,
        issuerPubY: pub.y,
        subject: subject.toString(),
        msg: F.toObject(msg).toString(),
        sigR8x: F.toObject(sig.R8[0]).toString(),
        sigR8y: F.toObject(sig.R8[1]).toString(),
        sigS: sig.S.toString(),
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

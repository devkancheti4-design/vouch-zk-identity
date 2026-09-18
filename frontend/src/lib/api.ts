/** Client for the issuer API — the service a bank or KYC provider runs. */
import { issue, toDays, today, type Credential, type IssuerKey } from "./credential";
import { deployment } from "./chain";

/**
 * Where the issuer lives.
 * Deployed, it is this same origin (Vercel serverless functions under /api).
 * Locally it is the Express server on :4000, unless VITE_ISSUER_API says otherwise.
 */
const isLocalHost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const BASE = (import.meta.env.VITE_ISSUER_API as string | undefined) ?? (isLocalHost ? "http://localhost:4000" : "");

export interface IssuerInfo { name: string; pubX: string; pubY: string; issuedCount: number; inBrowser?: boolean }

/**
 * On a static host (GitHub Pages) there is no server to issue anything, so the demo issuer
 * signs in this tab instead.
 *
 * This is honest only because the DEMO issuer's key is public by construction -- it is
 * sha256 of its own label, so anyone can derive it, and every page here already says the
 * verifier chooses which issuer key it trusts. It does mean that on the static deploy the
 * issuer is not a separate party, which is the one thing a real deployment must not do. The
 * header says so rather than hiding it.
 */
async function browserIssuer(): Promise<IssuerKey> {
  const bytes = new TextEncoder().encode(deployment.issuerLabel);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { name: deployment.issuerLabel, priv: digest, x: deployment.issuerPubX, y: deployment.issuerPubY };
}

export async function getIssuer(): Promise<IssuerInfo> {
  try {
    const r = await fetch(`${BASE}/api/issuer`);
    if (r.ok) return r.json();
  } catch { /* no server here; fall through */ }
  const k = await browserIssuer();
  return { name: k.name, pubX: k.x, pubY: k.y, issuedCount: 0, inBrowser: true };
}

export interface IssueRequest {
  holderCommitment: string;
  dob: string;
  balance: number;
  countryCode: number;
  accredited: boolean;
  validDays?: number;
}

export async function requestCredential(req: IssueRequest): Promise<Credential> {
  try {
    const r = await fetch(`${BASE}/api/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "issuance failed");
    return body.credential as Credential;
  } catch (e) {
    if (e instanceof Error && e.message && !/fetch|network|Failed/i.test(e.message)) throw e;
    // static host: sign here instead, with the same primitives the server would have used
    const k = await browserIssuer();
    return issue(k, BigInt(req.holderCommitment === "" ? "0" : req.holderCommitment), {
      dobDays: toDays(req.dob),
      balance: Math.floor(req.balance),
      countryCode: req.countryCode,
      flags: req.accredited ? 1 : 0,
      expiresAt: today() + (req.validDays ?? 365),
    });
  }
}

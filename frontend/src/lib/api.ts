/** Client for the issuer API — the service a bank or KYC provider runs. */
import type { Credential } from "./credential";

/**
 * Where the issuer lives.
 * Deployed, it is this same origin (Vercel serverless functions under /api).
 * Locally it is the Express server on :4000, unless VITE_ISSUER_API says otherwise.
 */
const isLocalHost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const BASE = (import.meta.env.VITE_ISSUER_API as string | undefined) ?? (isLocalHost ? "http://localhost:4000" : "");

export interface IssuerInfo { name: string; pubX: string; pubY: string; issuedCount: number }

export async function getIssuer(): Promise<IssuerInfo> {
  const r = await fetch(`${BASE}/api/issuer`);
  if (!r.ok) throw new Error("the issuer service is not reachable");
  return r.json();
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
  const r = await fetch(`${BASE}/api/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "issuance failed");
  return body.credential as Credential;
}

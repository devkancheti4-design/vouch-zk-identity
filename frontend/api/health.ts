import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Deliberately depends on nothing. If this answers and /api/issuer does not, the fault is in
 * the crypto stack rather than in the deployment -- which is the one thing you cannot tell
 * from FUNCTION_INVOCATION_FAILED alone.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    ok: true,
    issuer: process.env.ISSUER_LABEL ?? "Demo KYC Provider",
    node: process.version,
  });
}

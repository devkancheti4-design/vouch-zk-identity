import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ISSUER_LABEL, cors } from "./_issuer";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  cors(res);
  res.status(200).json({ ok: true, issuer: ISSUER_LABEL });
}

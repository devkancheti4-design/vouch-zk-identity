/** CLI: issue a credential and prove a policy over it. Usage: node prove.mjs */
import * as snarkjs from "snarkjs";
import { issue, issuerPublicKey, keyFromLabel, toDays, today, witnessInput, PUBLIC_SIGNAL_NAMES } from "./lib/credential.mjs";
import fs from "node:fs";

const issuerKey = keyFromLabel("Demo KYC Provider");
const issuerPub = await issuerPublicKey(issuerKey);
const holderSecret = 123456789012345678901234567890n;

const cred = await issue(issuerKey, holderSecret, {
  dobDays: toDays("1990-01-15"),
  balance: 250000,
  countryCode: 826,
  flags: 1,
  expiresAt: today() + 365,
});
const policy = { nowDays: today(), minAgeDays: 18 * 365, minBalance: 10000, requireAge: 1, requireBalance: 1, requireAccredited: 1, contextId: 42 };
const input = await witnessInput(cred, holderSecret, issuerPub, policy);
fs.writeFileSync("build/input.json", JSON.stringify(input, null, 2));

const t0 = performance.now();
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "build/vouch_js/vouch.wasm", "build/vouch_final.zkey");
const ms = performance.now() - t0;
const vk = JSON.parse(fs.readFileSync("build/verification_key.json"));
const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);

console.log(`proved in ${ms.toFixed(0)} ms, verified: ${ok}`);
console.log("\npublic signals (everything the world sees):");
publicSignals.forEach((v, i) => console.log(`  ${PUBLIC_SIGNAL_NAMES[i].padEnd(18)} ${v.length > 40 ? v.slice(0, 40) + "…" : v}`));
console.log("\nprivate, never emitted: dob, balance, country, flags, expiry, secret, signature");
fs.writeFileSync("build/proof.json", JSON.stringify(proof, null, 2));
fs.writeFileSync("build/public.json", JSON.stringify(publicSignals, null, 2));
process.exit(ok ? 0 : 1);

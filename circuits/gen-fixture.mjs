/** Generates the real proof calldata the Solidity tests embed. */
import * as snarkjs from "snarkjs";
import fs from "node:fs";
import { issue, issuerPublicKey, keyFromLabel, toDays, today, witnessInput } from "./lib/credential.mjs";

const issuerKey = keyFromLabel("Demo KYC Provider");
const issuerPub = await issuerPublicKey(issuerKey);
const secret = 111111111111111111111n;
const cred = await issue(issuerKey, secret, { dobDays: toDays("1990-01-15"), balance: 250000, countryCode: 826, flags: 1, expiresAt: today() + 365 });

// policy 1 as published by the deploy script: "Over 18"
const policy = { nowDays: today(), minAgeDays: 18 * 365, minBalance: 0, requireAge: 1, requireBalance: 0, requireAccredited: 0, contextId: 1 };
const { proof, publicSignals } = await snarkjs.groth16.fullProve(await witnessInput(cred, secret, issuerPub, policy), "build/vouch_js/vouch.wasm", "build/vouch_final.zkey");
const ok = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync("build/verification_key.json")), publicSignals, proof);
if (!ok) throw new Error("fixture proof does not verify");
const cd = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
fs.writeFileSync("build/fixture.json", JSON.stringify({ issuerPubX: issuerPub.x, issuerPubY: issuerPub.y, nowDays: policy.nowDays, minAgeDays: policy.minAgeDays, calldata: JSON.parse("[" + cd + "]") }, null, 2));
console.log("fixture written · nowDays", policy.nowDays, "· signals", publicSignals.length);
process.exit(0);

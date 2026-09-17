import { useState } from "react";
import type { Address } from "viem";
import { issue, proveClaim, today, toDays, type IssuerKey } from "../lib/credential";
import { REGISTRY, deployment, publicClient, short, vouchRegistryAbi } from "../lib/chain";

interface Run { label: string; signals: string[] }

/**
 * The claim this page makes is the one a mentor will press hardest on: that nothing private
 * reaches the public signals. It is settled here the only way it can be — by proving the same
 * statement from wildly different private data and comparing the output.
 */
export function Audit({ issuerKey, holderAddr }: { issuerKey?: IssuerKey; holderAddr: Address }) {
  const [rows, setRows] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string }>();
  const [chain, setChain] = useState<{ policyId: number; name: string; count: number; cleared: boolean }[]>();

  // the issuer key is public, so the browser can sign demo credentials for this experiment
  // without the server; the point being tested is the circuit, not the issuance path
  const localIssuer = async (): Promise<IssuerKey> => {
    const bytes = new TextEncoder().encode(deployment.issuerLabel);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return { name: deployment.issuerLabel, priv: digest, x: deployment.issuerPubX, y: deployment.issuerPubY };
  };

  const run = async () => {
    setBusy(true); setRows([]); setVerdict(undefined);
    try {
      const iss = await localIssuer();
      const secret = 111111111111111111111n;
      const base = { dobDays: toDays("1990-01-15"), balance: 250000, countryCode: 826, flags: 1, expiresAt: today() + 365 };
      const policy = {
        policyId: 2, name: "audit", nowDays: today(), minAgeDays: 18 * 365, minBalance: 10000,
        requireAge: true, requireBalance: true, requireAccredited: true,
      };
      const cases = [
        { label: "born 1990 · reserves 250,000 · UK", secret, attrs: base },
        { label: "born 1961 · reserves 250,000 · UK", secret, attrs: { ...base, dobDays: toDays("1961-03-02") } },
        { label: "born 1990 · reserves 9,999,999 · UK", secret, attrs: { ...base, balance: 9999999 } },
        { label: "born 1990 · reserves 250,000 · Germany", secret, attrs: { ...base, countryCode: 276 } },
        { label: "a different person entirely", secret: 999999999999999999999n, attrs: { ...base, dobDays: toDays("1977-11-09"), balance: 123456, countryCode: 356 } },
      ];
      const out: Run[] = [];
      for (const c of cases) {
        const cred = await issue(iss, c.secret, c.attrs);
        const b = await proveClaim(cred, c.secret, iss, policy);
        out.push({ label: c.label, signals: b.publicSignals });
        setRows([...out]);
      }
      const rest = out.map((r) => r.signals.slice(1).join("|"));
      const allRestSame = rest.every((s) => s === rest[0]);
      const firstFourNullifiersSame = new Set(out.slice(0, 4).map((r) => r.signals[0])).size === 1;
      const lastNullifierDiffers = out[4].signals[0] !== out[0].signals[0];
      setVerdict(allRestSame && firstFourNullifiersSame && lastNullifierDiffers
        ? { ok: true, text: "Four different private datasets produced byte-identical public signals. The only value that moved is the nullifier, and only when the person changed." }
        : { ok: false, text: "UNEXPECTED — a public signal moved with the private data. That would be a leak." });
    } catch (e) {
      setVerdict({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };

  const readChain = async () => {
    const out = [];
    for (const p of deployment.policies as { policyId: number; name: string }[]) {
      const count = (await publicClient.readContract({ address: REGISTRY, abi: vouchRegistryAbi, functionName: "clearedCount", args: [BigInt(p.policyId)] })) as bigint;
      const cleared = (await publicClient.readContract({ address: REGISTRY, abi: vouchRegistryAbi, functionName: "isCleared", args: [holderAddr, BigInt(p.policyId)] })) as boolean;
      out.push({ policyId: p.policyId, name: p.name, count: Number(count), cleared });
    }
    setChain(out);
  };

  return (
    <div>
      <div className="page-h"><h2>What leaks?</h2><span className="muted">the honest test: change the private data, and see whether the public output moves</span></div>

      <div className="card">
        <p>
          A zero-knowledge claim is easy to assert and easy to fake. The way to settle it is an
          information-flow argument: <b>if a private value could be recovered from the public signals,
          then changing that value would have to change one of them.</b> So this proves the same claim
          five times from different private data and compares the output byte for byte.
        </p>
        <button className="btn primary big" onClick={run} disabled={busy || !issuerKey}>
          {busy ? `proving… (${rows.length}/5)` : "Run the leak test"}
        </button>
        {rows.length > 0 && (
          <table className="tbl">
            <thead><tr><td>private data (never transmitted)</td><td>nullifier</td><td>every other public signal</td></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td className="mono">{short(r.signals[0], 13)}</td>
                  <td className="mono small">{short(r.signals.slice(1).join(" · "), 64)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {verdict && <div className={verdict.ok ? "ok-line big" : "bad-line big"}>{verdict.text}</div>}
        <p className="muted small">
          The automated suite runs the same experiment plus twenty-one others:
          <span className="mono"> cd circuits &amp;&amp; node --test test/zk.test.mjs</span>
        </p>
      </div>

      <div className="card">
        <h3>What the chain actually stored</h3>
        <button className="btn" onClick={readChain}>Read the registry</button>
        {chain && (
          <table className="tbl">
            <thead><tr><td>policy</td><td>people cleared</td><td>this wallet</td></tr></thead>
            <tbody>
              {chain.map((c) => (
                <tr key={c.policyId}><td>{c.name}</td><td className="mono">{c.count}</td><td>{c.cleared ? "cleared ✓" : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">
          That is the whole record: a count, a boolean per address, and a set of spent nullifiers. There is no
          getter for a birthday or a balance because neither was ever written. The contract has no function
          that could return one.
        </p>
      </div>
    </div>
  );
}

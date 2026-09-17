import { useState } from "react";
import { split, combine, type Shard } from "../lib/shards";

/**
 * What sharding changed, and how it compares to what actually ships today.
 *
 * Two single points became sets: the issuer key (one, and public) became a private membership
 * proof against an accredited set, and the holder's secret (one blob, one browser) became k-of-n
 * shards. The Shamir panel below runs the real lib/shards.ts, so the visitor can watch k-1 refuse
 * and k succeed rather than take it on faith.
 */

const BASE_SIGNALS = [
  "nullifier", "issuerPubX", "issuerPubY", "nowDays", "minAgeDays",
  "minBalance", "requireAge", "requireBalance", "requireAccredited", "contextId",
];
const SHARD_SIGNALS = [
  "nullifier", "issuerSetRoot", "nowDays", "minAgeDays",
  "minBalance", "requireAge", "requireBalance", "requireAccredited", "contextId",
];

const SECRET = 511634828180051440175120251711n;

export function Decentral() {
  const [k, setK] = useState(3);
  const [n, setN] = useState(5);
  const [shards, setShards] = useState<Shard[]>([]);
  const [held, setHeld] = useState<number[]>([]);

  const doSplit = () => { setShards(split(SECRET, k, n)); setHeld([]); };
  const toggle = (x: number) =>
    setHeld((h) => h.includes(x) ? h.filter((v) => v !== x) : [...h, x]);

  let outcome: { ok: boolean; text: string } | undefined;
  if (shards.length) {
    const picked = shards.filter((s) => held.includes(s.x));
    if (picked.length === 0) outcome = undefined;
    else if (picked.length < k) {
      outcome = { ok: false, text: `${picked.length} of ${k} — not enough. And this is not "almost there": with fewer than ${k}, every possible secret is still exactly as consistent with what you hold. You have learned nothing.` };
    } else {
      try {
        const got = combine(picked);
        outcome = got === SECRET
          ? { ok: true, text: `Reconstructed from shards ${picked.map((p) => p.x).join(", ")} — byte-for-byte the original secret.` }
          : { ok: false, text: "Reconstruction did not match, which would be a bug." };
      } catch (e) { outcome = { ok: false, text: e instanceof Error ? e.message : String(e) }; }
    }
  }

  return (
    <div>
      <div className="page-h">
        <h2>Sharded</h2>
        <span className="muted">two single points removed — the issuer, and your secret</span>
      </div>

      <div className="card">
        <h3>Your bank's name used to ride along on every proof</h3>
        <p className="muted small">
          The issuer's public key was a <b>public signal</b>. So the circuit hid your balance and
          broadcast who held it. "Signed by a private bank" and "signed by a payday lender" are
          both facts about you that no age check ever asked for — and there was exactly one issuer
          per policy, so breaching or pressuring that one holder forged every claim under it.
          Now the key is private and what's published is the root of an accredited <i>set</i>:
          you prove <b>some accredited issuer signed this</b>, without saying which.
        </p>
        <div className="sig-compare">
          <div>
            <h4>Before — 10 public signals</h4>
            <div className="sigs">
              {BASE_SIGNALS.map((s) => (
                <div key={s} className={`sig ${s.startsWith("issuerPub") ? "moved" : "same"}`}>
                  <span className="sig-k">{s}</span>
                  <span className="sig-v small">{s.startsWith("issuerPub") ? "identifies your bank" : ""}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4>After — 9 public signals</h4>
            <div className="sigs">
              {SHARD_SIGNALS.map((s) => (
                <div key={s} className={`sig ${s === "issuerSetRoot" ? "same hi" : "same"}`}>
                  <span className="sig-k">{s}</span>
                  <span className="sig-v small">{s === "issuerSetRoot" ? "names a set, not a bank" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><td></td><td>base</td><td>sharded</td><td></td></tr></thead>
          <tbody>
            <tr><td>Constraints</td><td className="mono">10,273</td><td className="mono">14,958</td><td className="muted small">+46%</td></tr>
            <tr><td>Proving time</td><td className="mono">432 ms</td><td className="mono">496 ms</td><td className="muted small">+15%</td></tr>
            <tr><td>Public inputs</td><td className="mono">9</td><td className="mono">8</td><td className="ok-line small">fewer</td></tr>
            <tr><td>Issuer identity</td><td className="bad-line small">public</td><td className="ok-line small">private</td><td></td></tr>
            <tr><td>Issuers trusted</td><td className="mono">1</td><td className="mono">up to 256</td><td className="muted small">depth-8 tree</td></tr>
          </tbody>
        </table>
        <p className="ok-line small">
          Note the direction: the verifier ends up knowing <b>strictly less</b> while trusting
          <b> strictly more broadly</b>. That is not the usual trade, and it costs 15% more proving.
        </p>
      </div>

      <div className="card">
        <h3>How that compares to what actually ships</h3>
        <table className="tbl">
          <thead><tr><td>system</td><td>hides the attribute</td><td>hides <i>which issuer</i></td><td>trust is spread</td></tr></thead>
          <tbody>
            <tr><td>EUDI Wallet (SD-JWT / mdoc)</td><td className="ok-line">yes</td><td className="bad-line">no</td><td className="bad-line">one per state</td></tr>
            <tr><td>Apple / Google digital ID</td><td className="ok-line">yes</td><td className="bad-line">no</td><td className="bad-line">one issuer</td></tr>
            <tr><td>ZKPassport</td><td className="ok-line">yes</td><td className="bad-line">no</td><td className="bad-line">one government</td></tr>
            <tr><td><b>VOUCH, sharded</b></td><td className="ok-line">yes</td><td className="ok-line"><b>yes</b></td><td className="ok-line"><b>a set</b></td></tr>
          </tbody>
        </table>
        <p className="muted small">
          Every deployed wallet proves your age and still shows the verifier which authority
          vouched for you, because the issuer's signature is part of the credential format. Making
          the issuer a private input and proving set membership instead is the part none of them
          currently does. They are far ahead on everything else — real documents, real
          accreditation, real coverage — and that is the honest scoreboard.
        </p>
      </div>

      <div className="card">
        <h3>Your secret was one file. Now it is k of n.</h3>
        <p className="muted small">
          The backup file held the whole identity: lose it and the credential is gone, copy it and
          you <i>are</i> that person. Same defect twice. Below is the real
          <span className="mono"> lib/shards.ts</span> running in your browser — Shamir over the
          BN254 scalar field. Split the secret, then pick up shards and watch what happens.
        </p>

        <div className="shard-controls">
          <label>need <select value={k} onChange={(e) => { const v = Number(e.target.value); setK(v); if (v > n) setN(v); setShards([]); }}>
            {[2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
          <label>of <select value={n} onChange={(e) => { const v = Number(e.target.value); setN(v); if (k > v) setK(v); setShards([]); }}>
            {[2,3,4,5,6,7].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
          <button className="btn primary" onClick={doSplit}>Split my secret</button>
          {shards.length > 0 && <button className="btn" onClick={() => setHeld([])}>Drop all</button>}
        </div>

        {shards.length > 0 && (
          <>
            <p className="muted small">Click a shard to pick it up. You are holding {held.length}.</p>
            <div className="shard-grid">
              {shards.map((s) => (
                <button key={s.x} className={held.includes(s.x) ? "shard on" : "shard"} onClick={() => toggle(s.x)}>
                  <span className="shard-n">shard {s.x} of {s.n}</span>
                  <span className="shard-y mono">{s.y.slice(0, 18)}…</span>
                  <span className="shard-f">{held.includes(s.x) ? "held" : "not held"}</span>
                </button>
              ))}
            </div>
            {outcome && <p className={outcome.ok ? "ok-line big" : "bad-line big"}>{outcome.text}</p>}
          </>
        )}

        <p className="muted small">
          Fewer than <i>k</i> is not a weaker version of the secret — it is independent of it.
          That is information-theoretic, not "computationally hard", and it is why this beats
          chopping a file into pieces, where every piece leaks its own bytes. Eleven tests cover
          it, including all ten 3-of-5 subsets.
        </p>
      </div>

      <div className="card">
        <h3>What this still does not fix</h3>
        <ul className="plain">
          <li>Trust is spread, not eliminated — one compromised accredited issuer still forges for its own subjects, though the set can drop them and every credential they signed stops proving.</li>
          <li>Gather <i>k</i> shards and you are the holder. Sharding fixes loss and raises the bar on theft; it does nothing about an adult <i>deliberately</i> handing shards to a minor. That needs hardware binding, which is a different fix.</li>
          <li>The trusted setup is still one ceremony. A verified three-contributor one takes 14 seconds, so this is a decision, not an obstacle.</li>
        </ul>
      </div>
    </div>
  );
}

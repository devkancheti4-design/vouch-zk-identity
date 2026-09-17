import { useState } from "react";

/**
 * Architecture and engineering rationale.
 *
 * Every number on this page was measured, not estimated: the constraint costs come from
 * compiling each circomlib component on its own (circuits/bench), the timings from the browser
 * prover, the gas from a Hardhat run against the real verifier.
 *
 * Chart palette validated with the dataviz validator against this surface:
 *   0d9488, 2563eb, ea580c, 7c3aed, e11d48 — all checks pass (dark, surface #111c25).
 * Adjacent tritan ΔE is 6.4, inside the floor band, so every bar carries a direct label.
 */
const CAT = ["#0d9488", "#2563eb", "#ea580c", "#7c3aed", "#e11d48"];
const ONE_HUE = "#2563eb";

interface Bar { label: string; value: number; note?: string; color?: string }

function BarChart({ data, unit, total, single }: { data: Bar[]; unit: string; total?: number; single?: boolean }) {
  const [hover, setHover] = useState<number>();
  const max = Math.max(...data.map((d) => d.value));
  const rowH = 38, gap = 2, padL = 232, padR = 136, w = 860;
  const h = data.length * rowH;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h + 10}`} role="img" aria-label={`${unit} by category`} className="chartsvg">
        <line x1={padL} y1={0} x2={padL} y2={h} stroke="#2a3f52" strokeWidth="1" />
        {data.map((d, i) => {
          const bw = Math.max(3, ((w - padL - padR) * d.value) / max);
          const y = i * rowH + gap;
          const bh = rowH - gap * 2 - 6;
          const fill = single ? ONE_HUE : (d.color ?? CAT[i % CAT.length]);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(undefined)}>
              <rect x={0} y={y} width={w} height={rowH - gap} fill={hover === i ? "#ffffff08" : "transparent"} />
              <text x={padL - 12} y={y + bh / 2 + 5} textAnchor="end" className="c-lab">{d.label}</text>
              <path
                d={`M ${padL} ${y} h ${bw - 4} a 4 4 0 0 1 4 4 v ${bh - 8} a 4 4 0 0 1 -4 4 h ${-(bw - 4)} z`}
                fill={fill} opacity={hover === undefined || hover === i ? 1 : 0.5}
              />
              <text x={padL + bw + 10} y={y + bh / 2 + 5} className="c-val">
                {d.value.toLocaleString()}{total ? ` · ${((d.value / total) * 100).toFixed(1)}%` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== undefined && data[hover].note && <div className="c-tip">{data[hover].note}</div>}
      <div className="c-unit">{unit}</div>
    </div>
  );
}

const CONSTRAINTS: Bar[] = [
  { label: "EdDSA signature check", value: 8086, note: "Verifying the issuer really signed this credential. Four fifths of the whole circuit." },
  { label: "Poseidon · credential", value: 967, note: "Hashes the six attributes into the one field element the signature covers." },
  { label: "Poseidon · nullifier", value: 517, note: "Poseidon(secret, context). Stable per verifier, unlinkable across verifiers." },
  { label: "Poseidon · subject", value: 415, note: "Binds the credential to whoever knows the secret, so a stolen credential is useless." },
  { label: "Range checks", value: 271, note: "Three comparators. This is the compliance logic itself." },
  { label: "Flags and switches", value: 17, note: "Bit decomposition of the flags, plus booleanity on the three policy switches." },
];

const LOC: Bar[] = [
  { label: "TypeScript · dApp", value: 855, note: "The wallet, the shops and the leak audit." },
  { label: "JavaScript · server", value: 214, note: "The issuer API and the shared credential library." },
  { label: "Circom · circuit", value: 166, note: "The whole zero-knowledge statement, in 166 lines." },
  { label: "Solidity · registry", value: 149, note: "Hand-written. The 231-line verifier is generated, not counted." },
  { label: "CSS · the site", value: 110 },
];

const PIPELINE: Bar[] = [
  { label: "Build the proof", value: 553, note: "Witness generation plus Groth16 proving, in WASM, on the holder's own machine." },
  { label: "Verify it locally", value: 8, note: "The browser checks its own proof before sending anything, so a bad proof never leaves." },
  { label: "Issue the credential", value: 12, note: "One Poseidon hash and one EdDSA signature. Happens once, ever." },
];

export function BuiltWith() {
  return (
    <div>
      <div className="page-h"><h2>How it is built</h2><span className="muted">every number here was measured in this repository, not estimated</span></div>

      <section className="strip">
        <div><b>10,273</b><span>circuit constraints</span></div>
        <div><b>9</b><span>private inputs, never public</span></div>
        <div><b>553 ms</b><span>to prove, in the browser</span></div>
        <div><b>357k</b><span>gas to verify on-chain</span></div>
      </section>

      <section className="card wide">
        <h3>The three tiers, and what each one is allowed to know</h3>
        <svg viewBox="0 0 900 260" className="archsvg" role="img" aria-label="architecture diagram">
          <defs>
            <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8ba0b3" />
            </marker>
          </defs>
          {[
            { x: 20, t: "ISSUER — a server", s: "Node + circomlibjs", c: "#ea580c", k: ["holds the signing key", "runs the identity check once", "signs six attributes"], n: "knows your details" },
            { x: 320, t: "HOLDER — a browser", s: "TypeScript + snarkjs WASM", c: "#0d9488", k: ["stores the credential", "stores the secret", "builds every proof"], n: "knows everything" },
            { x: 620, t: "VERIFIER — a chain", s: "Solidity, snarkjs-generated", c: "#2563eb", k: ["checks the pairing", "burns the nullifier", "stores one boolean"], n: "knows nothing about you" },
          ].map((b) => (
            <g key={b.t}>
              <rect x={b.x} y={20} width={260} height={172} rx={13} fill="#0d151c" stroke={b.c} strokeWidth="1.5" />
              <text x={b.x + 18} y={48} className="a-t" fill={b.c}>{b.t}</text>
              <text x={b.x + 18} y={68} className="a-s">{b.s}</text>
              {b.k.map((k, i) => <text key={k} x={b.x + 18} y={98 + i * 22} className="a-k">· {k}</text>)}
              <text x={b.x + 18} y={176} className="a-n" fill={b.c}>{b.n}</text>
            </g>
          ))}
          <path d="M 282 106 H 316" stroke="#8ba0b3" strokeWidth="1.5" markerEnd="url(#ar)" />
          <text x="286" y="98" className="a-e">credential</text>
          <path d="M 582 106 H 616" stroke="#8ba0b3" strokeWidth="1.5" markerEnd="url(#ar)" />
          <text x="590" y="98" className="a-e">proof only</text>
          <text x="20" y="232" className="a-f">The issuer is never contacted again after issuance. It cannot see which verifier you visit, or when — so it cannot build a profile even if it wanted to.</text>
        </svg>
      </section>

      <section className="card wide">
        <h3>Where the 10,273 constraints go</h3>
        <p className="muted small">Measured by compiling each circomlib component on its own. The headline: proving <b>who vouched for you</b> costs 79% of the circuit, while the compliance logic everyone talks about — age, balance, accreditation — is 2.6% of it. Privacy is nearly free; trust is what you pay for.</p>
        <BarChart data={CONSTRAINTS} unit="R1CS constraints" total={10273} single />
      </section>

      <section className="cols2">
        <div className="card">
          <h3>What the user waits for</h3>
          <p className="muted small">One-off issuance, then every later proof is under a second. Nothing is batched, cached or faked.</p>
          <BarChart data={PIPELINE} unit="milliseconds" single />
        </div>
        <div className="card">
          <h3>Hand-written source, by language</h3>
          <p className="muted small">Excludes dependencies, generated ABIs, and the 231-line verifier snarkjs writes for us. Tests add 359 lines on top.</p>
          <BarChart data={LOC} unit="lines of code" />
        </div>
      </section>

      <section className="card wide">
        <h3>Why each language, and what we turned down</h3>
        <table className="tbl lang">
          <thead><tr><td>language</td><td>what it does here</td><td>why this one</td></tr></thead>
          <tbody>
            <tr>
              <td><b style={{ color: CAT[2] }}>Circom</b></td>
              <td>The circuit: signature check, predicates, nullifier.</td>
              <td>It has the only mature standard library (circomlib) with an audited EdDSA and Poseidon. Hand-rolling elliptic-curve signature verification inside a circuit is exactly where soundness bugs come from, so we did not.</td>
            </tr>
            <tr>
              <td><b style={{ color: CAT[1] }}>Solidity</b></td>
              <td>The verifier and the registry.</td>
              <td>The verifier is not a choice — snarkjs generates it. We hand-wrote only the registry around it, whose job is to bind the proof to a published policy and store one boolean.</td>
            </tr>
            <tr>
              <td><b style={{ color: CAT[0] }}>TypeScript</b></td>
              <td>The dApp: wallet, shops, the leak audit.</td>
              <td>The proof is built on the holder's machine, so the prover must be JavaScript. Types earn their keep because the ten public signals are positional — a mis-ordered one would break the policy binding silently rather than erroring.</td>
            </tr>
            <tr>
              <td><b style={{ color: CAT[3] }}>JavaScript (Node)</b></td>
              <td>The issuer API and the shared credential library.</td>
              <td>circomlibjs is a Node library, and the issuer <em>must</em> be server-side because it holds the signing key. Keeping it plain <span className="mono">.mjs</span> lets the server, the tests and the browser share one implementation, so what gets signed cannot drift from what the circuit verifies.</td>
            </tr>
            <tr>
              <td><b style={{ color: CAT[4] }}>CSS</b></td>
              <td>The site.</td>
              <td>No framework. The whole interface is five pages; a design system would have outweighed the thing it was styling.</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ marginTop: 22 }}>The four decisions a reviewer will question</h3>
        <div className="why-grid">
          {[
            ["Groth16, not PLONK or STARKs", "Groth16 has the smallest proof (256 bytes) and the cheapest on-chain verification. Its cost is a per-circuit trusted setup, which is acceptable precisely because this circuit is fixed and public. A universal setup would buy flexibility we do not need."],
            ["EdDSA over BabyJubJub, not ECDSA", "ECDSA over secp256k1 inside a circuit costs tens of thousands of constraints because the curve is foreign to the proving field. BabyJubJub is native to it, so the same security costs 8,086 instead."],
            ["Poseidon, not SHA-256", "SHA-256 is roughly 25,000 constraints per block. Poseidon is designed for this field and costs a few hundred. Using SHA-256 here would have quadrupled the circuit for no gain."],
            ["A server issuer, not browser signing", "An earlier version signed in the browser, which is simpler and wrong: a real issuer's key must never reach the user. Moving it to a service also made the demo honest about who knows what."],
          ].map(([h, b]) => (
            <div className="why" key={h}><b>{h}</b><span className="muted">{b}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

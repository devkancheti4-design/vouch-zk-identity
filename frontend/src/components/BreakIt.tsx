import { useState } from "react";
import { PUBLIC_SIGNAL_NAMES, issue, proveClaim, today, toDays, type IssuerKey } from "../lib/credential";
import { deployment, short } from "../lib/chain";

/**
 * The canned leak test proves the claim. This lets the visitor try to BREAK it.
 *
 * They choose the private data themselves, we generate a real proof from it, and every public
 * signal is compared against the first proof they made. Anything that moves is highlighted in
 * red. The honest outcome is that nothing moves but the nullifier, and that only when they
 * change who they are — but they get to establish that rather than be told it.
 */
interface Attempt {
  n: number;
  label: string;
  signals: string[];
  ms: number;
  moved: string[];        // names of signals that differ from the reference
}

const PEOPLE = [
  { id: "A", name: "you", secret: 111111111111111111111n },
  { id: "B", name: "someone else", secret: 999999999999999999999n },
];

export function BreakIt({ issuerKey }: { issuerKey?: IssuerKey }) {
  const [dob, setDob] = useState("1990-01-15");
  const [balance, setBalance] = useState(250000);
  const [country, setCountry] = useState(826);
  const [accredited, setAccredited] = useState(true);
  const [who, setWho] = useState("A");

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const ref = attempts[0];
  const leaks = attempts.filter((a) => a.moved.some((m) => m !== "nullifier")).length;

  const localIssuer = async (): Promise<IssuerKey> => {
    const bytes = new TextEncoder().encode(deployment.issuerLabel);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return { name: deployment.issuerLabel, priv: digest, x: deployment.issuerPubX, y: deployment.issuerPubY };
  };

  const attempt = async () => {
    setBusy(true); setErr(undefined);
    try {
      const iss = await localIssuer();
      const person = PEOPLE.find((p) => p.id === who)!;
      const attrs = {
        dobDays: toDays(dob),
        balance,
        countryCode: country,
        flags: accredited ? 1 : 0,
        expiresAt: today() + 365,
      };
      // one fixed policy, so anything that moves in the output came from the PRIVATE data
      const policy = {
        policyId: 2, name: "break-it", nowDays: today(), minAgeDays: 18 * 365, minBalance: 10000,
        requireAge: true, requireBalance: true, requireAccredited: true,
      };
      const cred = await issue(iss, person.secret, attrs);
      const b = await proveClaim(cred, person.secret, iss, policy);

      const moved = ref
        ? PUBLIC_SIGNAL_NAMES.filter((_, i) => b.publicSignals[i] !== ref.signals[i])
        : [];
      setAttempts((prev) => [...prev, {
        n: prev.length + 1,
        label: `${person.name} · born ${dob} · ${balance.toLocaleString()} · ${COUNTRY[country]}${accredited ? " · accredited" : ""}`,
        signals: b.publicSignals, ms: Math.round(b.ms), moved: [...moved],
      }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h3>Try to break it yourself</h3>
      <p className="muted small">
        Set the private data to anything you like and prove the same claim. Every public signal is
        compared against your first attempt. If any value other than the nullifier moves, you have
        found a leak — and the whole project is wrong.
      </p>

      <div className="break-grid">
        <label>Date of birth
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </label>
        <label>Reserves
          <input type="number" min={10000} step={1000} value={balance}
                 onChange={(e) => setBalance(Math.max(10000, Number(e.target.value) || 10000))} />
        </label>
        <label>Country
          <select value={country} onChange={(e) => setCountry(Number(e.target.value))}>
            {Object.entries(COUNTRY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Who is proving
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="break-check">
          <input type="checkbox" checked={accredited} onChange={(e) => setAccredited(e.target.checked)} />
          <span>Accredited investor</span>
        </label>
      </div>

      <div className="break-actions">
        <button className="btn primary" onClick={attempt} disabled={busy || !issuerKey}>
          {busy ? "proving…" : attempts.length ? "Prove again with these values" : "Prove it"}
        </button>
        {attempts.length > 0 && (
          <button className="btn" onClick={() => setAttempts([])}>Reset</button>
        )}
        {attempts.length > 0 && (
          <span className={leaks ? "bad-line" : "ok-line"}>
            {attempts.length} proof{attempts.length > 1 ? "s" : ""} · {leaks} leak{leaks === 1 ? "" : "s"} found
          </span>
        )}
      </div>
      {err && <p className="bad-line">{err}</p>}

      {ref && (
        <>
          <p className="muted small break-legend">
            <b>Reference</b> is your first proof. Below it, every signal is shown as it compares —
            <span className="sig same"> unchanged </span> or <span className="sig moved"> moved </span>.
          </p>
          {attempts.map((a) => (
            <div key={a.n} className="attempt">
              <div className="attempt-h">
                <span className="attempt-n">{a.n === 1 ? "REFERENCE" : `attempt ${a.n}`}</span>
                <span className="muted small">{a.label}</span>
                <span className="muted small mono">{a.ms} ms</span>
              </div>
              <div className="sigs">
                {PUBLIC_SIGNAL_NAMES.map((name, i) => {
                  const moved = a.n > 1 && a.signals[i] !== ref.signals[i];
                  return (
                    <div key={name} className={`sig ${a.n === 1 ? "" : moved ? "moved" : "same"}`}>
                      <span className="sig-k">{name}</span>
                      <span className="sig-v mono">{short(a.signals[i], 12)}</span>
                    </div>
                  );
                })}
              </div>
              {a.n > 1 && (
                <p className={a.moved.some((m) => m !== "nullifier") ? "bad-line small" : "ok-line small"}>
                  {a.moved.length === 0
                    ? "Nothing moved. Different private data, byte-identical public output."
                    : a.moved.every((m) => m === "nullifier")
                      ? "Only the nullifier moved — because you changed who is proving, which is what it is for."
                      : `LEAK: ${a.moved.filter((m) => m !== "nullifier").join(", ")} moved with the private data.`}
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const COUNTRY: Record<number, string> = { 826: "United Kingdom", 276: "Germany", 356: "India", 840: "United States" };

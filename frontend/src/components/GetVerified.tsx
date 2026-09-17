import { useState } from "react";
import { requestCredential } from "../lib/api";
import { subjectOf, type Credential } from "../lib/credential";

const COUNTRIES: [number, string][] = [[826, "United Kingdom"], [276, "Germany"], [356, "India"], [840, "United States"]];

export function GetVerified({ secret, onIssued, existing }: { secret: bigint; onIssued: (c: Credential) => void; existing?: Credential }) {
  const [dob, setDob] = useState("1990-01-15");
  const [balance, setBalance] = useState("250000");
  const [countryCode, setCountryCode] = useState(826);
  const [accredited, setAccredited] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const submit = async () => {
    setBusy(true); setErr(undefined);
    try {
      const holderCommitment = await subjectOf(secret);
      const cred = await requestCredential({ holderCommitment, dob, balance: Number(balance), countryCode, accredited, validDays: 365 });
      onIssued(cred);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="narrow">
      <div className="page-h"><h2>Get verified</h2><span className="muted">this happens once, with one provider, and never again</span></div>

      <div className="card">
        <div className="provider">
          <span className="logo">🏛</span>
          <div><b>Demo KYC Provider</b><span className="muted small">a stand-in for your bank, your government, or a provider like Onfido or Persona</span></div>
        </div>
        <p className="muted small">
          In production this form is replaced by a real identity check: a document scan, a liveness test, an
          open-banking connection. What matters for the demo is what happens at the end — the provider signs
          these attributes with a key held on <b>their server</b>, and the result is handed to you.
        </p>

        <div className="form-grid">
          <label>Date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
          <label>Verified reserves<input value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9]/g, ""))} /></label>
          <label>Country<select value={countryCode} onChange={(e) => setCountryCode(Number(e.target.value))}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select></label>
          <label className="chk"><input type="checkbox" checked={accredited} onChange={(e) => setAccredited(e.target.checked)} />Qualifies as an accredited investor</label>
        </div>

        <div className="note">
          <b>What the provider learns:</b> these details, once — the same things your bank already knows.
          <br /><b>What it never learns:</b> your wallet secret, which shops you visit afterwards, or when.
        </div>

        <button className="btn primary big" onClick={submit} disabled={busy}>
          {busy ? "signing…" : existing ? "Re-issue my credential" : "Issue my credential"}
        </button>
        {err && <div className="bad-line">{err}</div>}
      </div>
    </div>
  );
}

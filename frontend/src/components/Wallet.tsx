import { SHOPS, type Page, type PolicyMeta } from "../App";
import { deployment } from "../lib/chain";
import { fromDays, type Credential } from "../lib/credential";

const COUNTRY: Record<number, string> = { 826: "United Kingdom", 276: "Germany", 356: "India", 840: "United States" };
const age = (dobDays: number) => Math.floor((Date.now() / 86400000 - dobDays) / 365.25);

export function Wallet({ cred, secret, clearedMap, onReset, setPage }: {
  cred?: Credential; secret: bigint; clearedMap: Record<number, boolean>; onReset: () => void; setPage: (p: Page) => void;
}) {
  if (!cred) {
    return (
      <div className="narrow">
        <div className="page-h"><h2>My wallet</h2></div>
        <div className="card empty">
          <p>Your wallet is empty. Get a credential from the provider first — it takes one click.</p>
          <button className="btn primary" onClick={() => setPage("verify")}>Get verified</button>
        </div>
      </div>
    );
  }
  const policies = deployment.policies as PolicyMeta[];
  const can = (p: PolicyMeta) =>
    (!p.requireAge || age(cred.dobDays) * 365 >= p.minAgeDays) &&
    (!p.requireBalance || cred.balance >= p.minBalance) &&
    (!p.requireAccredited || (cred.flags & 1) === 1);

  return (
    <div className="narrow">
      <div className="page-h"><h2>My wallet</h2><span className="muted">held in this browser only — nothing here has ever been transmitted</span></div>

      <div className="card cred-card">
        <div className="cred-top">
          <span className="logo">🪪</span>
          <div><b>Verified credential</b><span className="muted small">issued by {cred.issuerName} · expires {fromDays(cred.expiresAt)}</span></div>
          <span className="chip ok">signed ✓</span>
        </div>
        <div className="private">
          <div className="private-h">🔒 PRIVATE — visible on this screen, and nowhere else in the world</div>
          <Row k="Date of birth" v={`${fromDays(cred.dobDays)}  (age ${age(cred.dobDays)})`} />
          <Row k="Verified reserves" v={cred.balance.toLocaleString()} />
          <Row k="Country" v={COUNTRY[cred.countryCode] ?? String(cred.countryCode)} />
          <Row k="Accredited investor" v={(cred.flags & 1) === 1 ? "yes" : "no"} />
          <Row k="Issuer signature" v={cred.sigS.slice(0, 30) + "…"} mono />
          <Row k="Your wallet secret" v={secret.toString().slice(0, 30) + "…"} mono />
        </div>
      </div>

      <div className="card">
        <h3>What you can prove with it</h3>
        <p className="muted small">Each of these is one claim. Proving one tells a verifier nothing about the others.</p>
        <div className="claims">
          {policies.map((p) => {
            const ok = can(p);
            const done = clearedMap[p.policyId];
            const shop = SHOPS.find((s) => s.policyId === p.policyId);
            return (
              <div key={p.policyId} className={`claim ${ok ? "" : "no"}`}>
                <span className="claim-icon">{ok ? "✓" : "✕"}</span>
                <div>
                  <b>{p.name}</b>
                  <span className="muted small">{shop ? `asked for by ${shop.brand}` : ""}{done ? " · already proven" : ""}</span>
                </div>
                {ok
                  ? <button className="btn" onClick={() => setPage("shop")}>{done ? "Proven" : "Use it"}</button>
                  : <span className="muted small">your credential does not qualify</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Wallet controls</h3>
        <p className="muted small">Clearing the wallet destroys the credential and the secret. There is no backup and no recovery, because neither was ever sent anywhere.</p>
        <button className="btn warn" onClick={onReset}>Erase this wallet</button>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="row"><span className="k">{k}</span><span className={mono ? "v mono" : "v"}>{v}</span></div>;
}

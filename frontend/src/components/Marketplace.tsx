import { useState } from "react";
import { SHOPS, type Page, type Shop } from "../App";
import type { Credential, ProofBundle } from "../lib/credential";
import { PUBLIC_SIGNAL_NAMES } from "../lib/credential";
import { short } from "../lib/chain";

type State = { phase: "idle" | "proving" | "verifying" | "done" | "error"; bundle?: ProofBundle; gas?: string; error?: string };

export function Marketplace({ cred, clearedMap, proveAndClear, setPage }: {
  cred?: Credential;
  clearedMap: Record<number, boolean>;
  proveAndClear: (policyId: number) => Promise<{ bundle: ProofBundle; gas: string }>;
  setPage: (p: Page) => void;
}) {
  const [states, setStates] = useState<Record<number, State>>({});
  const set = (id: number, s: State) => setStates((m) => ({ ...m, [id]: s }));

  const run = async (shop: Shop) => {
    set(shop.policyId, { phase: "proving" });
    try {
      // the proof is built first, in the browser; only then does anything touch the network
      const started = performance.now();
      const { bundle, gas } = await proveAndClear(shop.policyId);
      void started;
      set(shop.policyId, { phase: "done", bundle, gas });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(shop.policyId, {
        phase: "error",
        error: /Assert Failed|Error in template/i.test(msg)
          ? "No proof exists — your credential does not meet this requirement. Nothing was sent."
          : /AlreadyCleared/.test(msg) ? "You have already been cleared here."
          : /NullifierSpent/.test(msg) ? "This credential has already been used at this shop."
          : msg.split("\n")[0].slice(0, 140),
      });
    }
  };

  return (
    <div>
      <div className="page-h">
        <h2>Where it's used</h2>
        <span className="muted">three businesses, three different questions, one credential — and none of them learn anything</span>
      </div>
      {!cred && (
        <div className="banner">
          You have no credential yet. <button className="link" onClick={() => setPage("verify")}>Get verified first</button>.
        </div>
      )}
      <div className="shops">
        {SHOPS.map((shop) => {
          const st = states[shop.policyId] ?? { phase: clearedMap[shop.policyId] ? "done" : "idle" } as State;
          const unlocked = st.phase === "done" || clearedMap[shop.policyId];
          return (
            <div className="shop" key={shop.policyId} style={{ borderColor: unlocked ? shop.accent : undefined }}>
              <div className="shop-top" style={{ background: `linear-gradient(160deg, ${shop.accent}22, transparent)` }}>
                <span className="shop-emoji">{shop.emoji}</span>
                <div><b style={{ color: shop.accent }}>{shop.brand}</b><span className="muted small">{shop.tagline}</span></div>
              </div>
              <div className="shop-body">
                <div className="product"><b>{shop.product}</b><span className="price">{shop.price}</span></div>
                <div className="demand"><span className="lock">{unlocked ? "🔓" : "🔒"}</span>{shop.demand}</div>

                {!unlocked && (
                  <button className="btn primary" disabled={!cred || st.phase === "proving" || st.phase === "verifying"} onClick={() => run(shop)}>
                    {st.phase === "proving" ? "building your proof…" : "Prove it privately"}
                  </button>
                )}
                {st.phase === "error" && <div className="bad-line">{st.error}</div>}

                {unlocked && (
                  <>
                    <div className="unlocked" style={{ color: shop.accent }}>Unlocked ✓</div>
                    <p className="muted small">{shop.afterText}</p>
                    <button className="btn" style={{ borderColor: shop.accent }}>
                      {shop.policyId === 1 ? "Add to basket" : shop.policyId === 2 ? "View allocation" : "Book a viewing"}
                    </button>
                  </>
                )}

                {st.bundle && (
                  <details className="receipt">
                    <summary>What this shop received ({st.gas ? Number(st.gas).toLocaleString() : "…"} gas)</summary>
                    <div className="sig-list">
                      {st.bundle.publicSignals.map((v, i) => (
                        <div className="row" key={i}><span className="k">{PUBLIC_SIGNAL_NAMES[i]}</span><span className="v mono">{short(v, 22)}</span></div>
                      ))}
                    </div>
                    <p className="muted small">Proved in {st.bundle.ms.toFixed(0)} ms in your browser. Not one of these values is a fact about you.</p>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

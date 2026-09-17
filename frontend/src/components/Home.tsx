import type { Page } from "../App";
import { SHOPS } from "../App";

export function Home({ setPage, hasCred, clearedMap }: { setPage: (p: Page) => void; hasCred: boolean; clearedMap: Record<number, boolean> }) {
  const clearedN = Object.values(clearedMap).filter(Boolean).length;
  return (
    <div className="home">
      <section className="hero">
        <h1>Prove you qualify.<br /><em>Show them nothing.</em></h1>
        <p className="lede">
          Every age check today works the same way: to prove one fact, you hand over a document that
          reveals fifty. Your birthday, your address, your photo, your document number — all of it, to a
          shop that only needed to know you are over 18.
        </p>
        <p className="lede">
          VOUCH replaces the document with a proof. A bank or KYC provider signs your details once.
          After that your browser can prove any single claim about them — old enough, solvent enough,
          accredited — to anyone, forever, without the claim's subject ever leaving your device.
        </p>
        <div className="cta">
          <button className="btn primary big" onClick={() => setPage(hasCred ? "shop" : "verify")}>
            {hasCred ? "Try it in a real shop" : "Get verified — it takes one click"}
          </button>
          <button className="btn big" onClick={() => setPage("audit")}>Show me it really hides the data</button>
        </div>
      </section>

      <section className="three">
        {[
          ["1", "A provider verifies you once", "Your bank or a KYC provider does the boring identity work a single time and signs the result. Their signing key lives on their server; the signed credential lands in your browser."],
          ["2", "You prove one claim at a time", "When a shop asks something, your browser builds a zero-knowledge proof of just that one claim. The credential itself never moves."],
          ["3", "They verify without learning", "A smart contract checks the proof's mathematics. It records that somebody qualified, and can never work out who, or by how much."],
        ].map(([n, h, b]) => (
          <div className="card step-card" key={n}>
            <span className="num">{n}</span>
            <h3>{h}</h3>
            <p className="muted">{b}</p>
          </div>
        ))}
      </section>

      <section className="card wide">
        <h3>What a verifier actually receives</h3>
        <div className="compare">
          <div className="pane today">
            <div className="pane-h">Today — a photo of your passport</div>
            <ul>
              <li>Full legal name</li><li>Exact date of birth</li><li>Document number</li>
              <li>Nationality and place of birth</li><li>Your face</li><li>Signature</li>
              <li className="hl">…to answer one yes/no question</li>
            </ul>
          </div>
          <div className="arrow">→</div>
          <div className="pane vouch">
            <div className="pane-h">With VOUCH — ten numbers</div>
            <ul>
              <li>A one-time nullifier</li><li>The issuer's public key</li><li>Today's date</li>
              <li>The threshold that was demanded</li><li>Which checks were asked for</li>
              <li>Which shop asked</li>
              <li className="hl">…and the answer is yes</li>
            </ul>
          </div>
        </div>
        <p className="muted small">
          Every one of those ten numbers except the nullifier is a value the <b>verifier chose themselves</b>.
          A value they already knew cannot tell them anything new about you.
        </p>
      </section>

      <section className="strip">
        <div><b>{hasCred ? "1" : "0"}</b><span>credential in your wallet</span></div>
        <div><b>{clearedN}</b><span>of {SHOPS.length} shops unlocked</span></div>
        <div><b>0</b><span>personal details disclosed</span></div>
      </section>
    </div>
  );
}

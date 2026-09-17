// Builds deck/VOUCH.pptx from the measured results. Run: node build.cjs
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.author = "VOUCH";
pres.title = "VOUCH — validate compliance claims without disclosing the data";

const C = { bg: "080D12", card: "111C25", line: "1E2F3D", line2: "2A3F52", text: "E8EFF5", muted: "8BA0B3",
  accent: "5EEAD4", priv: "FFB86B", pub: "63A4FF", ok: "4ADE80", bad: "FF6B7A", violet: "C4B5FD" };
const HEAD = "Cambria", BODY = "Calibri", MONO = "Courier New";

function slide(title, sub) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  if (title) s.addText(title, { x: 0.5, y: 0.28, w: 9, h: 0.58, fontFace: HEAD, fontSize: 30, bold: true, color: C.text, isTextBox: true, margin: 0, valign: "middle" });
  if (sub) s.addText(sub, { x: 0.5, y: 0.86, w: 9, h: 0.36, fontFace: BODY, fontSize: 13, color: C.muted, isTextBox: true, margin: 0, valign: "middle" });
  return s;
}
const T = (s, t, o) => s.addText(t, Object.assign({ fontFace: BODY, fontSize: 13, color: C.text, isTextBox: true, margin: 0, valign: "top" }, o));
const box = (s, x, y, w, h, fill, line) =>
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: line || fill, width: 1 }, rectRadius: 0.08 });
function stat(s, x, y, w, big, label, color, size) {
  T(s, big, { x, y, w, h: 0.62, fontFace: HEAD, fontSize: size || 34, bold: true, color: color || C.accent, valign: "bottom" });
  T(s, label, { x, y: y + 0.64, w, h: 0.5, fontSize: 10.5, color: C.muted });
}
const evid = (s, t) => T(s, "evidence · " + t, { x: 0.5, y: 5.22, w: 9, h: 0.28, fontFace: MONO, fontSize: 8.5, color: C.muted });

// ------------------------------------------------------------------ 1 title
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  T(s, "VOUCH", { x: 0.7, y: 0.95, w: 8.6, h: 1.0, fontFace: HEAD, fontSize: 56, bold: true, color: C.accent, valign: "middle" });
  T(s, "Prove you qualify. Show them nothing.", { x: 0.7, y: 1.95, w: 8.6, h: 0.55, fontFace: HEAD, fontSize: 25, color: C.text, valign: "middle" });
  T(s, "A privacy-preserving identity system that VALIDATES compliance claims — age, solvency, accreditation — without disclosing a single underlying fact.", { x: 0.7, y: 2.55, w: 8.6, h: 0.6, fontSize: 14, color: C.muted, italic: true });
  const st = [["10,273", "circuit constraints"], ["9", "private inputs, never public"], ["553 ms", "to prove, in the browser"], ["21 / 21", "checks pass, live, in 8 s"]];
  st.forEach(([v, l], i) => stat(s, 0.7 + i * 2.2, 3.35, 2.1, v, l, C.accent, 26));
  T(s, "github.com/devkancheti4-design/vouch-zk-identity  ·  circom + snarkjs + Solidity + React  ·  32 headless tests, 21 live", { x: 0.7, y: 4.88, w: 8.6, h: 0.3, fontFace: MONO, fontSize: 9, color: C.muted });
  s.addNotes("VOUCH is built for the brief: validate compliance claims without disclosing underlying sensitive data. Nine private inputs, none of which reach the public signals. Everything on these slides was measured in the repository.");
}

// ------------------------------------------------------- 2 the problem
{
  const s = slide("Verification today means disclosure", "To prove one fact you hand over a document that reveals fifty.");
  box(s, 0.5, 1.35, 4.2, 3.4, C.card, "6B3B3B");
  T(s, "TODAY — a photo of your passport", { x: 0.72, y: 1.5, w: 3.8, h: 0.3, fontSize: 11.5, bold: true, color: C.bad });
  const today = ["Full legal name", "Exact date of birth", "Document number", "Nationality and birthplace", "Your face", "Your signature"];
  s.addText(today.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < today.length - 1, paraSpaceAfter: 5 } })),
    { x: 0.72, y: 1.9, w: 3.8, h: 2.1, fontFace: BODY, fontSize: 12.5, color: C.text, isTextBox: true, margin: 0 });
  T(s, "…to answer one yes/no question.", { x: 0.72, y: 4.12, w: 3.8, h: 0.5, fontSize: 12.5, italic: true, color: C.bad });

  T(s, "→", { x: 4.78, y: 2.85, w: 0.45, h: 0.4, fontSize: 24, color: C.muted, align: "center" });

  box(s, 5.3, 1.35, 4.2, 3.4, C.card, "1F7A6D");
  T(s, "WITH VOUCH — ten numbers", { x: 5.52, y: 1.5, w: 3.8, h: 0.3, fontSize: 11.5, bold: true, color: C.accent });
  const ours = ["A one-time nullifier", "The issuer's public key", "Today's date", "The threshold demanded", "Which checks were asked for", "Which verifier asked"];
  s.addText(ours.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < ours.length - 1, paraSpaceAfter: 5 } })),
    { x: 5.52, y: 1.9, w: 3.8, h: 2.1, fontFace: BODY, fontSize: 12.5, color: C.text, isTextBox: true, margin: 0 });
  T(s, "…and the answer is yes.", { x: 5.52, y: 4.12, w: 3.8, h: 0.5, fontSize: 12.5, italic: true, color: C.accent });

  T(s, "Nine of those ten numbers are values the verifier chose themselves. A value they already knew cannot tell them anything new about you.", { x: 0.5, y: 4.85, w: 9, h: 0.35, fontSize: 11, color: C.muted });
  s.addNotes("Lead with the everyday absurdity: a bar learns your address to check your age. The fix is not better data handling, it is not sending the data.");
}

// ------------------------------------------------------- 3 the brief
{
  const s = slide("The brief, line by line", "The statement asked us to VALIDATE compliance claims without disclosing the data. Each line, and where it is answered.");
  const rows = [
    ["Generate valid zk-SNARK proofs for compliance verification (age, balance threshold)", "Groth16 over a 10,273-constraint circom circuit. Three switchable predicates: age, balance, accreditation.", "circuits/vouch.circom"],
    ["Verify proofs client-side or on-chain without exposing raw data", "Both. The browser verifies before sending; a generated Solidity verifier re-checks on-chain for ~357k gas.", "VouchRegistry.sol"],
    ["Full UI pipeline for credential issuance and proof verification", "Issuer service → browser wallet → three storefronts that each demand a different claim.", "server/ + frontend/"],
    ["…without disclosing underlying sensitive data", "Nine private inputs, none reaching the public signals. Settled by information flow, not assertion.", "21 live checks"],
  ];
  rows.forEach(([q, a, w], i) => {
    const y = 1.35 + i * 0.93;
    box(s, 0.5, y, 9, 0.84, C.card, C.line);
    s.addShape(pres.ShapeType.ellipse, { x: 0.68, y: y + 0.28, w: 0.28, h: 0.28, fill: { color: "0F3B36" }, line: { color: C.ok, width: 1 } });
    T(s, "✓", { x: 0.68, y: y + 0.28, w: 0.28, h: 0.28, fontSize: 12, bold: true, color: C.ok, align: "center", valign: "middle" });
    T(s, `“${q}”`, { x: 1.06, y: y + 0.1, w: 5.0, h: 0.32, fontSize: 11, italic: true, color: C.text });
    T(s, a, { x: 1.06, y: y + 0.42, w: 6.5, h: 0.38, fontSize: 10.5, color: C.muted });
    T(s, w, { x: 7.7, y: y + 0.24, w: 1.65, h: 0.4, fontFace: MONO, fontSize: 9, color: C.accent, align: "right", valign: "middle" });
  });
  evid(s, "the Validation page in the app maps each of these to a live test");
  s.addNotes("Show the judges you read the brief. Each quoted line is answered by something they can click on.");
}

// ------------------------------------------------------- 4 how it works
{
  const s = slide("Three tiers, and what each is allowed to know", "The issuer is never contacted again after issuance, so it cannot follow you.");
  const tiers = [
    ["ISSUER — a server", "Node + circomlibjs", ["holds the signing key", "runs the identity check once", "signs six attributes"], "knows your details", C.priv],
    ["HOLDER — a browser", "TypeScript + snarkjs WASM", ["stores the credential", "stores the secret", "builds every proof"], "knows everything", C.accent],
    ["VERIFIER — a chain", "Solidity, snarkjs-generated", ["checks the pairing", "burns the nullifier", "stores one boolean"], "knows nothing about you", C.pub],
  ];
  tiers.forEach(([t, sub, ks, note, col], i) => {
    const x = 0.5 + i * 3.08;
    box(s, x, 1.35, 2.9, 2.5, C.card, col);
    T(s, t, { x: x + 0.18, y: 1.48, w: 2.55, h: 0.3, fontFace: MONO, fontSize: 10.5, bold: true, color: col });
    T(s, sub, { x: x + 0.18, y: 1.76, w: 2.55, h: 0.26, fontFace: MONO, fontSize: 9, color: C.muted });
    s.addText(ks.map((k, j) => ({ text: k, options: { bullet: true, breakLine: j < ks.length - 1, paraSpaceAfter: 4 } })),
      { x: x + 0.18, y: 2.08, w: 2.55, h: 1.1, fontFace: BODY, fontSize: 11, color: C.text, isTextBox: true, margin: 0 });
    T(s, note, { x: x + 0.18, y: 3.42, w: 2.55, h: 0.32, fontSize: 11, italic: true, color: col });
  });
  T(s, "credential →", { x: 3.42, y: 2.2, w: 0.9, h: 0.3, fontFace: MONO, fontSize: 9, color: C.muted, align: "center" });
  T(s, "proof only →", { x: 6.5, y: 2.2, w: 0.9, h: 0.3, fontFace: MONO, fontSize: 9, color: C.muted, align: "center" });
  box(s, 0.5, 4.05, 9, 0.75, C.card, C.line);
  T(s, "The issuer signs once and is then out of the picture. It cannot see which verifier you visit, or when — so it cannot build a profile even if it wanted to. That is the difference between this and “sign in with your bank”.", { x: 0.72, y: 4.05, w: 8.6, h: 0.75, fontSize: 11.5, color: C.muted, valign: "middle" });
  evid(s, "server/src/index.mjs · frontend/src/lib/credential.ts · contracts/VouchRegistry.sol");
  s.addNotes("The architectural point: privacy fails when the issuer stays in the loop. Here it does not.");
}

// ------------------------------------------------------- 5 the circuit
{
  const s = slide("What the circuit actually proves", "Five things at once, in 166 lines of circom. If any is false, no proof exists at all.");
  const items = [
    ["The credential carries a valid EdDSA signature", "from the issuer the verifier named — not any issuer"],
    ["The prover knows the secret it was issued to", "so a stolen credential is worthless"],
    ["The credential has not expired", "checked inside the circuit, against the verifier's clock"],
    ["Each demanded predicate holds", "age ≥ N · balance ≥ N · accredited — switchable per policy"],
    ["The nullifier is Poseidon(secret, context)", "stable for one verifier, unlinkable across two"],
  ];
  items.forEach(([h, sub], i) => {
    const y = 1.32 + i * 0.6;
    s.addShape(pres.ShapeType.ellipse, { x: 0.5, y: y + 0.08, w: 0.26, h: 0.26, fill: { color: C.accent } });
    T(s, String(i + 1), { x: 0.5, y: y + 0.08, w: 0.26, h: 0.26, fontSize: 11, bold: true, color: "06131A", align: "center", valign: "middle" });
    T(s, h, { x: 0.88, y: y, w: 4.5, h: 0.42, fontSize: 12.5, bold: true, color: C.text, valign: "middle" });
    T(s, sub, { x: 5.45, y: y, w: 4.0, h: 0.42, fontSize: 11, color: C.muted, valign: "middle" });
  });
  box(s, 0.5, 4.35, 9, 0.72, C.card, C.line2);
  T(s, [
    { text: "A false claim is not rejected — it is unprovable. ", options: { bold: true, color: C.accent } },
    { text: "An underage holder cannot construct a proof at all. The prover has nothing to lie with.", options: { color: C.muted } },
  ], { x: 0.72, y: 4.35, w: 8.6, h: 0.72, fontSize: 12, valign: "middle" });
  evid(s, "circuits/vouch.circom · checks 10–13 and 14–16 on the Validation page");
  s.addNotes("The five-part statement. Emphasise that an invalid claim produces nothing, rather than producing something a verifier must catch.");
}

// ------------------------------------------- 6 zero private data (the one)
{
  const s = slide("Zero private data in the public signals", "The criterion that matters most, and the only honest way to settle it.");
  box(s, 0.5, 1.3, 9, 0.8, C.card, C.line2);
  T(s, "If a private value could be recovered from the public signals, then changing that value would have to change one of them.", { x: 0.72, y: 1.3, w: 8.6, h: 0.8, fontSize: 13.5, italic: true, color: C.text, valign: "middle" });

  const rows = [
    ["born 1990 · reserves 250,000 · UK", true],
    ["born 1961 · reserves 250,000 · UK", true],
    ["born 1990 · reserves 9,999,999 · UK", true],
    ["born 1990 · reserves 250,000 · Germany", true],
    ["a different person entirely", false],
  ];
  T(s, "PRIVATE DATA (never transmitted)", { x: 0.5, y: 2.25, w: 4.4, h: 0.26, fontSize: 9.5, bold: true, color: C.muted });
  T(s, "PUBLIC SIGNALS", { x: 5.1, y: 2.25, w: 4.4, h: 0.26, fontSize: 9.5, bold: true, color: C.muted });
  rows.forEach(([label, same], i) => {
    const y = 2.55 + i * 0.42;
    T(s, label, { x: 0.5, y, w: 4.4, h: 0.36, fontSize: 11.5, color: C.text, valign: "middle" });
    T(s, same ? "byte-identical" : "only the nullifier differs", { x: 5.1, y, w: 4.4, h: 0.36, fontFace: MONO, fontSize: 11, color: same ? C.ok : C.violet, valign: "middle" });
  });
  T(s, "Four different private datasets, byte-identical public output. The one value that moves is the nullifier, and only when the person changes.", { x: 0.5, y: 4.75, w: 9, h: 0.4, fontSize: 11.5, color: C.muted });
  evid(s, "run it yourself: the app's Validation page, checks 3–9 · circuits/test/zk.test.mjs suite 2");
  s.addNotes("This is the slide to linger on. The argument is information flow, not a promise. Offer to run it live — it takes eight seconds.");
}

// ------------------------------------------------------- 7 the numbers
{
  const s = slide("Where the cost actually goes", "Every figure measured in this repository — each circomlib component compiled on its own.");
  const bars = [
    ["EdDSA signature check", 8086, 78.7, C.pub],
    ["Poseidon hashes ×3", 1899, 18.5, C.accent],
    ["Range checks: age, expiry, balance", 271, 2.6, C.priv],
    ["Flags and policy switches", 17, 0.2, C.violet],
  ];
  const maxV = 8086, x0 = 3.55, wMax = 4.2;
  bars.forEach(([l, v, pct, col], i) => {
    const y = 1.35 + i * 0.52;
    T(s, l, { x: 0.5, y, w: 2.95, h: 0.34, fontSize: 11, color: C.muted, align: "right", valign: "middle" });
    s.addShape(pres.ShapeType.roundRect, { x: x0, y: y + 0.06, w: Math.max(0.06, (wMax * v) / maxV), h: 0.22, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.4 });
    T(s, `${v.toLocaleString()} · ${pct}%`, { x: x0 + wMax + 0.12, y, w: 1.6, h: 0.34, fontFace: MONO, fontSize: 10.5, color: C.text, valign: "middle" });
  });
  box(s, 0.5, 3.5, 9, 0.62, C.card, C.line2);
  T(s, [
    { text: "Proving WHO vouched for you costs 79% of the circuit. ", options: { bold: true, color: C.accent } },
    { text: "The compliance logic everyone talks about is 2.6% of it. Privacy is nearly free; trust is what you pay for.", options: { color: C.muted } },
  ], { x: 0.72, y: 3.5, w: 8.6, h: 0.62, fontSize: 12, valign: "middle" });
  const st = [["553 ms", "prove, in the browser"], ["8 ms", "verify, before sending"], ["357k", "gas, on-chain"], ["256 B", "proof size"]];
  st.forEach(([v, l], i) => stat(s, 0.5 + i * 2.3, 4.32, 2.1, v, l, C.accent, 22));
  evid(s, "circuits/bench (each component compiled alone) · contracts/test · the app's How it's built page");
  s.addNotes("The 79% figure is the most interesting engineering result in the project and nobody expects it.");
}

// ------------------------------------------------------- 8 languages
{
  const s = slide("The stack, and why each piece", "Four languages, each forced by a real constraint rather than taste.");
  const rows = [
    ["Circom", "the circuit", "The only mature DSL with an audited EdDSA and Poseidon (circomlib). Hand-rolling curve arithmetic in a circuit is where soundness bugs come from.", C.priv],
    ["Solidity", "verifier + registry", "The verifier is generated by snarkjs, so the language is not a choice. We hand-wrote only the registry that binds a proof to a policy.", C.pub],
    ["TypeScript", "the dApp", "The proof is built on the holder's machine, so the prover must be JavaScript. Types matter: the ten public signals are positional.", C.accent],
    ["Node (JS)", "the issuer API", "circomlibjs is a Node library, and the issuer must be server-side because it holds the key. One shared .mjs keeps server, tests and browser identical.", C.violet],
  ];
  rows.forEach(([lang, role, why, col], i) => {
    const y = 1.3 + i * 0.78;
    box(s, 0.5, y, 9, 0.7, C.card, C.line);
    T(s, lang, { x: 0.7, y: y + 0.06, w: 1.3, h: 0.3, fontSize: 13, bold: true, color: col });
    T(s, role, { x: 0.7, y: y + 0.36, w: 1.4, h: 0.28, fontSize: 10, color: C.muted });
    T(s, why, { x: 2.15, y, w: 7.15, h: 0.7, fontSize: 11, color: C.text, valign: "middle" });
  });
  T(s, "Turned down: PLONK (bigger on-chain cost; we do not need a universal setup) · ECDSA in-circuit (tens of thousands of constraints; BabyJubJub is native to the field) · SHA-256 (≈25k constraints per block, Poseidon is a few hundred).", { x: 0.5, y: 4.5, w: 9, h: 0.6, fontSize: 10.5, color: C.muted });
  evid(s, "hand-written: TypeScript 855 · JavaScript 214 · Circom 166 · Solidity 149 · CSS 110 lines");
  s.addNotes("Judges ask why circom and why Groth16. Have the alternatives and their costs ready.");
}

// ------------------------------------------------------- 9 validation
{
  const s = slide("Validation you can watch", "Twenty-one checks against real proofs and the real registry — in the browser, in eight seconds.");
  const groups = [
    ["Proof generation", 2, "a valid credential proves and verifies; the proof is constant size"],
    ["Zero private data in the public signals", 7, "vary dob, balance, country, flags — public output does not move"],
    ["A false claim is unprovable", 4, "underage, insolvent, unaccredited, expired: no proof exists"],
    ["A credential cannot be forged or stolen", 3, "rogue issuer, tampered attribute, wrong holder secret"],
    ["The nullifier", 2, "stable within a verifier, unlinkable across two"],
    ["On-chain verification", 3, "no getter returns personal data; replay is refused"],
  ];
  groups.forEach(([g, n, d], i) => {
    const y = 1.3 + i * 0.58;
    s.addShape(pres.ShapeType.ellipse, { x: 0.5, y: y + 0.08, w: 0.26, h: 0.26, fill: { color: "0F3B36" }, line: { color: C.ok, width: 1 } });
    T(s, "✓", { x: 0.5, y: y + 0.08, w: 0.26, h: 0.26, fontSize: 11, bold: true, color: C.ok, align: "center", valign: "middle" });
    T(s, g, { x: 0.88, y, w: 3.6, h: 0.4, fontSize: 12, bold: true, color: C.text, valign: "middle" });
    T(s, `${n} checks`, { x: 4.5, y, w: 0.85, h: 0.4, fontFace: MONO, fontSize: 10.5, color: C.accent, valign: "middle" });
    T(s, d, { x: 5.4, y, w: 4.1, h: 0.4, fontSize: 10.5, color: C.muted, valign: "middle" });
  });
  box(s, 0.5, 4.85, 9, 0.5, C.card, "1F5A36");
  T(s, "All 21 passed in 8.1 s · plus 32 headless tests in CI: 22 circuit, 10 registry driven by a real Groth16 proof.", { x: 0.72, y: 4.85, w: 8.6, h: 0.5, fontSize: 11.5, color: C.ok, valign: "middle" });
  evid(s, "frontend Validation page · circuits/test/zk.test.mjs · contracts/test/VouchRegistry.t.sol");
  s.addNotes("Offer to run this live. Eight seconds is short enough that saying no looks worse than saying yes.");
}

// ------------------------------------------------------- 10 limits
{
  const s = slide("What it does not do", "The boundaries, stated before anyone finds them.");
  const items = [
    ["Zero-knowledge does not make a lying issuer honest", "The system hides the data; it still trusts the provider to have attested truthfully. That is a governance problem, not a cryptographic one."],
    ["The ceremony is a local one-contributor setup", "Fixed entropy so the artifacts are reproducible for the demo. Production needs a multi-party ceremony over the same, unchanged circuit."],
    ["Revocation is by expiry only", "A revocation list would be a Merkle non-membership proof in the same circuit — designed for, not built."],
    ["The nullifier trades unlinkability for one-use", "Stable per verifier by design, so a verifier can refuse a second use. That is deliberate, and it is the only per-holder value that exists."],
  ];
  items.forEach(([h, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.35 + row * 1.5;
    box(s, x, y, 4.4, 1.35, C.card, C.line);
    s.addShape(pres.ShapeType.rect, { x: x + 0.2, y: y + 0.24, w: 0.1, h: 0.1, fill: { color: C.bad }, line: { color: C.bad, width: 0 }, rotate: 45 });
    T(s, h, { x: x + 0.45, y: y + 0.12, w: 3.8, h: 0.4, fontSize: 11.5, bold: true, color: C.text });
    T(s, b, { x: x + 0.45, y: y + 0.52, w: 3.8, h: 0.75, fontSize: 10.5, color: C.muted });
  });
  T(s, "None of these weaken the central claim, which is the one the brief asked for: the verifier learns whether you qualify, and nothing else.", { x: 0.5, y: 4.55, w: 9, h: 0.4, fontSize: 11.5, color: C.muted, italic: true });
  s.addNotes("Naming your own limits first is what separates a credible team from an over-claiming one.");
}

// ------------------------------------------------------- 11 reproduce
{
  const s = slide("Run it yourself", "Four terminals. Every number in this deck comes from one of them.");
  const cmds = [
    ["THE CIRCUIT", "cd circuits && npm install && npm run build", "10,273 constraints · 9 private"],
    ["THE CHAIN", "cd contracts && npm run node   /   npm run deploy:local", "verifier + registry + 3 policies"],
    ["THE ISSUER", "cd server && npm start", "signing key, server-side, :4000"],
    ["THE APP", "cd frontend && npm run dev -- --port 5176", "wallet · shops · validation"],
    ["THE TESTS", "cd circuits && node --test test/zk.test.mjs   ·   cd contracts && npx hardhat test", "22 + 10 passing"],
  ];
  cmds.forEach(([h, c, r], i) => {
    const y = 1.32 + i * 0.72;
    box(s, 0.5, y, 9, 0.64, C.card, C.line);
    T(s, h, { x: 0.68, y: y + 0.06, w: 1.6, h: 0.24, fontSize: 9, bold: true, color: C.muted });
    T(s, c, { x: 0.68, y: y + 0.3, w: 6.2, h: 0.3, fontFace: MONO, fontSize: 9.5, color: C.accent });
    T(s, r, { x: 7.0, y: y + 0.06, w: 2.35, h: 0.52, fontFace: MONO, fontSize: 9.5, color: C.ok, align: "right", valign: "middle" });
  });
  T(s, "github.com/devkancheti4-design/vouch-zk-identity   ·   circuits/  server/  contracts/  frontend/  README.md", { x: 0.5, y: 5.0, w: 9, h: 0.3, fontFace: MONO, fontSize: 9, color: C.muted });
  s.addNotes("Close here, then open the app and run the 21 checks.");
}

pres.writeFile({ fileName: "VOUCH.pptx" }).then((f) => console.log("wrote", f));

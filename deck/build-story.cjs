// Builds deck/VOUCH-STORY.pptx — problem statement, solution, and the sharding discipline.
// Every figure here was measured in this repository. Run: node build-story.cjs
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "VOUCH";
pres.title = "VOUCH — from problem statement to a sharded solution";

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

/* 1 ---------------------------------------------------------------- title */
{
  const s = pres.addSlide(); s.background = { color: C.bg };
  T(s, "VOUCH", { x: 0.7, y: 0.9, w: 8.6, h: 1.0, fontFace: HEAD, fontSize: 56, bold: true, color: C.accent, valign: "middle" });
  T(s, "Prove you qualify. Show them nothing.", { x: 0.7, y: 1.9, w: 8.6, h: 0.55, fontFace: HEAD, fontSize: 25, color: C.text, valign: "middle" });
  T(s, "The problem statement, how we validated it, the solution we authored, and the sharding discipline we applied to both.", { x: 0.7, y: 2.5, w: 8.6, h: 0.6, fontSize: 14, color: C.muted, italic: true });
  [["10,273", "circuit constraints"], ["9", "private inputs, none public"], ["358 ms", "to prove, in the browser"], ["58", "tests, all passing"]]
    .forEach(([v, l], i) => stat(s, 0.7 + i * 2.2, 3.3, 2.1, v, l, C.accent, 26));
  T(s, "./demo.sh  —  every number on these slides re-runs in 2.5 minutes, live", { x: 0.7, y: 4.85, w: 8.6, h: 0.3, fontFace: MONO, fontSize: 9.5, color: C.muted });
  s.addNotes("Open by saying the numbers are not from a slide, they are from a command we can run right now.");
}

/* 2 ------------------------------------------------------- problem statement */
{
  const s = slide("The problem statement", "given to us, verbatim");
  box(s, 0.5, 1.35, 9, 1.3, C.card, C.accent);
  T(s, "“Construct a privacy-focused identity verification system utilizing ZKPs to validate compliance claims without disclosing underlying sensitive data.”",
    { x: 0.8, y: 1.55, w: 8.4, h: 0.95, fontSize: 16.5, italic: true, color: C.text });
  T(s, "We read it as four testable obligations, not a theme:", { x: 0.5, y: 2.85, w: 9, h: 0.3, fontSize: 13, color: C.muted });
  const obl = [
    ["utilizing ZKPs", "a real proof system, not hashing or redaction", C.accent],
    ["validate compliance claims", "a verifier must end up genuinely convinced", C.pub],
    ["without disclosing", "the data must not be recoverable from the output", C.priv],
    ["underlying sensitive data", "date of birth, balance, nationality, status", C.violet],
  ];
  obl.forEach(([k, v, col], i) => {
    const y = 3.25 + i * 0.5;
    box(s, 0.5, y, 9, 0.44, C.card, C.line);
    T(s, k, { x: 0.7, y: y + 0.09, w: 2.9, h: 0.3, fontSize: 12.5, bold: true, color: col });
    T(s, v, { x: 3.6, y: y + 0.09, w: 5.7, h: 0.3, fontSize: 12, color: C.muted });
  });
  s.addNotes("The third obligation is the hard one. Anyone can claim it. We treated it as something that has to be falsifiable.");
}

/* 3 ------------------------------------------------------ validating the problem */
{
  const s = slide("First: is this a real problem?", "we checked before we built — the demand is regulatory, not speculative");
  const rows = [
    ["UK Online Safety Act", "age-assurance duties in force since 25 July 2025", C.ok],
    ["US state law", "age-verification statutes expanded sharply through 2025", C.ok],
    ["eIDAS 2.0 / EUDI Wallet", "EU wallet being built with proof-of-age as a cornerstone", C.ok],
  ];
  rows.forEach(([k, v, col], i) => {
    const y = 1.45 + i * 0.72;
    box(s, 0.5, y, 9, 0.62, C.card, C.line);
    T(s, k, { x: 0.75, y: y + 0.14, w: 3.1, h: 0.34, fontSize: 13.5, bold: true, color: col });
    T(s, v, { x: 3.9, y: y + 0.14, w: 5.4, h: 0.34, fontSize: 12.5, color: C.muted });
  });
  box(s, 0.5, 3.75, 9, 1.25, C.card, C.priv);
  T(s, "And we read the strongest argument AGAINST us.", { x: 0.75, y: 3.92, w: 8.5, h: 0.3, fontSize: 14, bold: true, color: C.priv });
  T(s, "The EFF published “ZKPs Aren’t Age Verification Silver Bullets” in August 2026. Of its five objections, two do not apply to VOUCH — the issuer is never contacted again, so it cannot track use; and the nullifier blocks the exact token-replay a researcher used to break a live scheme. The other three — centralised issuer, coverage, and whether age-gating is wise — apply in full, and we say so.",
    { x: 0.75, y: 4.22, w: 8.5, h: 0.72, fontSize: 11.5, color: C.muted });
  evid(s, "docs/WORTH.md  §3");
  s.addNotes("Engaging the best critique of your own category is more persuasive than any feature slide.");
}

/* 4 -------------------------------------------------------------- the solution */
{
  const s = slide("The solution we authored", "an issuer signs once, offline. Every proof after that is made by the holder, alone.");
  const step = [
    ["1 · ISSUE", "A bank signs your attributes with EdDSA.\nIt never sees you again.", C.priv],
    ["2 · PROVE", "Your browser builds a Groth16 proof\nthat a policy holds. 358 ms.", C.accent],
    ["3 · VERIFY", "A contract checks the pairing and\nstores one boolean. 381,755 gas.", C.pub],
  ];
  step.forEach(([k, v, col], i) => {
    const x = 0.5 + i * 3.1;
    box(s, x, 1.5, 2.85, 1.85, C.card, col);
    T(s, k, { x: x + 0.2, y: 1.68, w: 2.5, h: 0.32, fontSize: 13, bold: true, color: col });
    T(s, v, { x: x + 0.2, y: 2.05, w: 2.5, h: 1.1, fontSize: 12, color: C.text });
  });
  box(s, 0.5, 3.6, 9, 1.4, C.card, C.line2);
  T(s, "What crosses the wire", { x: 0.75, y: 3.75, w: 8.5, h: 0.3, fontSize: 13, bold: true, color: C.text });
  T(s, "PUBLIC   nullifier · issuer key · the policy · the verifier’s clock · a context id", { x: 0.75, y: 4.08, w: 8.5, h: 0.3, fontFace: MONO, fontSize: 11, color: C.pub });
  T(s, "PRIVATE  date of birth · balance · country · flags · expiry · your secret · the signature", { x: 0.75, y: 4.38, w: 8.5, h: 0.3, fontFace: MONO, fontSize: 11, color: C.priv });
  T(s, "Nine private inputs. Ten public signals. No overlap — and that is a test, not a promise.", { x: 0.75, y: 4.68, w: 8.5, h: 0.3, fontSize: 11.5, italic: true, color: C.muted });
  s.addNotes("The verifier learns a yes or no and a nullifier. Nothing else exists to leak.");
}

/* 5 ------------------------------------------------------------- the core proof */
{
  const s = slide("The claim, made falsifiable", "if a private value could be recovered from the output, changing it would move the output");
  box(s, 0.5, 1.4, 9, 2.0, C.card, C.line);
  const lines = [
    ["changing dobDays      changes NO public signal", C.ok],
    ["changing balance      changes NO public signal", C.ok],
    ["changing countryCode  changes NO public signal", C.ok],
    ["changing flags        changes NO public signal", C.ok],
    ["changing expiresAt    changes NO public signal", C.ok],
  ];
  lines.forEach(([t, col], i) => T(s, "  " + t, { x: 0.75, y: 1.62 + i * 0.33, w: 8.5, h: 0.3, fontFace: MONO, fontSize: 12.5, color: col }));
  T(s, "Two different people, different birthdays, different balances, proving the same policy — byte-identical public output but for the nullifier.",
    { x: 0.75, y: 3.28, w: 8.5, h: 0.3, fontSize: 11.5, italic: true, color: C.muted });
  box(s, 0.5, 3.75, 4.35, 1.25, C.card, C.accent);
  T(s, "And on the website", { x: 0.75, y: 3.9, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.accent });
  T(s, "A judge sets the private data themselves and watches the ten signals refuse to move. Running total: “N proofs · 0 leaks found.”",
    { x: 0.75, y: 4.2, w: 3.9, h: 0.72, fontSize: 11.5, color: C.text });
  box(s, 5.15, 3.75, 4.35, 1.25, C.card, C.violet);
  T(s, "A false claim is unprovable", { x: 5.4, y: 3.9, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.violet });
  T(s, "Underage, insolvent, unaccredited, expired — no proof exists at all. Not rejected later. Nothing to submit.",
    { x: 5.4, y: 4.2, w: 3.9, h: 0.72, fontSize: 11.5, color: C.text });
  evid(s, "circuits/test/zk.test.mjs — 22 tests");
  s.addNotes("This is the slide to linger on. It is the difference between claiming privacy and proving it.");
}

/* 6 ---------------------------------------------------------- sharding: the idea */
{
  const s = slide("Then we applied one discipline everywhere", "no single place should hold enough to reconstruct anything");
  box(s, 0.5, 1.4, 9, 0.95, C.card, C.accent);
  T(s, "Sharding is not ours. The one-time pad is from 1917 and Shamir’s secret sharing from 1979. The primitive is old and sound — we did not invent it and did not need to.",
    { x: 0.75, y: 1.58, w: 8.5, h: 0.62, fontSize: 13.5, color: C.text });
  T(s, "What we did was apply it, strictly, in three places where a single point still existed:", { x: 0.5, y: 2.55, w: 9, h: 0.3, fontSize: 13, color: C.muted });
  const apps = [
    ["THE HOLDER’S SECRET", "one blob in one browser", "Shamir k-of-n over BN254", C.accent],
    ["THE ISSUER", "one key, and it was PUBLIC", "membership in an accredited set", C.pub],
    ["FILES, in a sibling project", "one file in one place", "XOR n-of-n, content-addressed", C.violet],
  ];
  apps.forEach(([k, before, after, col], i) => {
    const y = 2.95 + i * 0.7;
    box(s, 0.5, y, 9, 0.6, C.card, C.line);
    T(s, k, { x: 0.7, y: y + 0.13, w: 2.7, h: 0.32, fontSize: 12, bold: true, color: col });
    T(s, before, { x: 3.4, y: y + 0.13, w: 2.6, h: 0.32, fontSize: 11.5, color: C.bad });
    T(s, "→  " + after, { x: 6.0, y: y + 0.13, w: 3.3, h: 0.32, fontSize: 11.5, color: C.ok });
  });
  s.addNotes("The honest framing: the cryptography was never the hard part. Operating it without a single point was.");
}

/* 7 ------------------------------------------------- sharding 1: holder's secret */
{
  const s = slide("Sharded #1 — the holder’s secret", "the wallet backup was the whole identity in one file");
  box(s, 0.5, 1.4, 4.35, 1.5, C.card, C.bad);
  T(s, "Before", { x: 0.75, y: 1.55, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.bad });
  T(s, "One file held the secret and the credential. Lose it and the credential is gone; copy it and you ARE that person. The same defect twice.",
    { x: 0.75, y: 1.88, w: 3.9, h: 0.92, fontSize: 12, color: C.text });
  box(s, 5.15, 1.4, 4.35, 1.5, C.card, C.ok);
  T(s, "After", { x: 5.4, y: 1.55, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.ok });
  T(s, "Shamir over the BN254 scalar field: any k of n reconstruct, so the shard is always a valid field element the circuit accepts.",
    { x: 5.4, y: 1.88, w: 3.9, h: 0.92, fontSize: 12, color: C.text });
  box(s, 0.5, 3.1, 9, 1.05, C.card, C.accent);
  T(s, "Fewer than k is not a weaker secret. It is independent of it.", { x: 0.75, y: 3.25, w: 8.5, h: 0.3, fontSize: 13.5, bold: true, color: C.accent });
  T(s, "Every candidate secret stays exactly as consistent with what you hold. Information-theoretic, not “computationally hard” — which is why this beats chopping a file into n pieces, where every piece leaks its own bytes. A test interpolates k−1 shards against five candidate secrets and shows each implies a different missing shard.",
    { x: 0.75, y: 3.55, w: 8.5, h: 0.55, fontSize: 11.5, color: C.muted });
  T(s, "11 tests — including all ten 3-of-5 subsets, not just a convenient one.", { x: 0.5, y: 4.35, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.text });
  evid(s, "frontend/src/lib/shards.ts  ·  frontend/test/shards.test.mjs");
}

/* 8 ---------------------------------------------------------- sharding 2: issuer */
{
  const s = slide("Sharded #2 — the issuer", "one key, and it was a public signal — two faults wearing one coat");
  box(s, 0.5, 1.35, 9, 0.85, C.card, C.bad);
  T(s, "The circuit was hiding your balance and broadcasting your bank.", { x: 0.75, y: 1.5, w: 8.5, h: 0.3, fontSize: 13.5, bold: true, color: C.bad });
  T(s, "issuerPubX and issuerPubY were public, so every verifier learned WHICH institution vouched for you — and there was exactly one per policy, so breaching it forged every claim.",
    { x: 0.75, y: 1.8, w: 8.5, h: 0.34, fontSize: 11.5, color: C.muted });
  const cmp = [
    ["Constraints", "10,273", "14,958", "+46%", C.muted],
    ["Proving time", "432 ms", "496 ms", "+15%", C.muted],
    ["Public inputs", "9", "8", "FEWER", C.ok],
    ["Issuer identity", "public", "private", "HIDDEN", C.ok],
    ["Issuers trusted", "1", "up to 256", "A SET", C.ok],
  ];
  T(s, "base", { x: 4.3, y: 2.35, w: 1.5, h: 0.25, fontSize: 10, color: C.muted });
  T(s, "sharded", { x: 5.9, y: 2.35, w: 1.5, h: 0.25, fontSize: 10, color: C.muted });
  cmp.forEach(([k, a, b, note, col], i) => {
    const y = 2.62 + i * 0.44;
    box(s, 0.5, y, 9, 0.38, C.card, C.line);
    T(s, k, { x: 0.7, y: y + 0.07, w: 3.5, h: 0.28, fontSize: 11.5, color: C.text });
    T(s, a, { x: 4.3, y: y + 0.07, w: 1.5, h: 0.28, fontFace: MONO, fontSize: 11, color: C.muted });
    T(s, b, { x: 5.9, y: y + 0.07, w: 1.6, h: 0.28, fontFace: MONO, fontSize: 11, color: C.text });
    T(s, note, { x: 7.7, y: y + 0.07, w: 1.6, h: 0.28, fontSize: 10.5, bold: true, color: col });
  });
  T(s, "Note the direction: the verifier ends up knowing STRICTLY LESS while trusting STRICTLY MORE BROADLY. That is not the usual trade.",
    { x: 0.5, y: 4.88, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.accent });
  evid(s, "circuits/experiments/vouch_shard.circom  ·  5 tests");
}

/* 9 ------------------------------------------------------ the sibling: sovereign mesh */
{
  const s = slide("Sharded #3 — sovereign mesh", "the same discipline applied to whole files, in a separate project");
  box(s, 0.5, 1.35, 9, 0.8, C.card, C.priv);
  T(s, "Be precise about this: VOUCH does not import sovereign mesh. They are separate codebases that apply one principle with deliberately different arithmetic.",
    { x: 0.75, y: 1.52, w: 8.5, h: 0.5, fontSize: 13, color: C.text });
  box(s, 0.5, 2.3, 4.35, 1.5, C.card, C.accent);
  T(s, "VOUCH — Shamir k-of-n", { x: 0.75, y: 2.45, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.accent });
  T(s, "A credential secret must survive a lost phone, so it needs RECOVERY. Any k of n rebuild it.",
    { x: 0.75, y: 2.78, w: 3.9, h: 0.92, fontSize: 12, color: C.text });
  box(s, 5.15, 2.3, 4.35, 1.5, C.card, C.violet);
  T(s, "Mesh — XOR n-of-n", { x: 5.4, y: 2.45, w: 3.9, h: 0.3, fontSize: 13, bold: true, color: C.violet });
  T(s, "A file you would rather destroy than have read needs STRICTNESS. All n required, no partial recovery.",
    { x: 5.4, y: 2.78, w: 3.9, h: 0.92, fontSize: 12, color: C.text });
  box(s, 0.5, 3.95, 9, 1.05, C.card, C.line2);
  T(s, "What the mesh enforces, rather than recommends", { x: 0.75, y: 4.08, w: 8.5, h: 0.3, fontSize: 12.5, bold: true, color: C.text });
  T(s, "One shard per trust domain, refused by st_dev and by a 409 · shards named by their own SHA-256 · a place is told HMAC(owner secret, file ‖ place), never the file id, so two places cannot discover they hold pieces of one file · an inventory that re-hashes everything, because n-of-n fails silently.",
    { x: 0.75, y: 4.38, w: 8.5, h: 0.58, fontSize: 11, color: C.muted });
  evid(s, "github.com/devkancheti4-design/sovereign-mesh  ·  ./selftest.sh, 7 checks");
  s.addNotes("The interesting engineering is choosing DIFFERENT arithmetic for different threat models, not reusing one library.");
}

/* 10 --------------------------------------------------------- what we found wrong */
{
  const s = slide("What we found in our own systems", "we went looking, and published what we found");
  box(s, 0.5, 1.35, 9, 1.5, C.card, C.bad);
  T(s, "VOUCH — the chain re-links what the circuit unlinked", { x: 0.75, y: 1.5, w: 8.5, h: 0.3, fontSize: 13.5, bold: true, color: C.bad });
  T(s, "We queried our own registry. The circuit emitted three unrelated nullifiers for one holder — it did its job. But Cleared() publishes msg.sender beside each, so an observer reads off-chain that ONE address is over-18 AND accredited AND solvent. The values stay hidden. The correlation does not.",
    { x: 0.75, y: 1.82, w: 8.5, h: 0.72, fontSize: 11.5, color: C.text });
  T(s, "Fix: a fresh address per policy — a wallet change, not a circuit change.", { x: 0.75, y: 2.55, w: 8.5, h: 0.25, fontSize: 11, italic: true, color: C.ok });
  box(s, 0.5, 3.0, 9, 1.4, C.card, C.bad);
  T(s, "Mesh — our own enforcement was the leak", { x: 0.75, y: 3.15, w: 8.5, h: 0.3, fontSize: 13.5, bold: true, color: C.bad });
  T(s, "To refuse a second shard, a place must remember something per file. Our first version used the file’s own hash — so anyone holding a document could ask “do you store a piece of this?” and get a yes, and two places comparing notes learned instantly they held pieces of one file.",
    { x: 0.75, y: 3.47, w: 8.5, h: 0.72, fontSize: 11.5, color: C.text });
  T(s, "Fix: an owner-keyed HMAC. Both attacks now have tests that fail if they return.", { x: 0.75, y: 4.1, w: 8.5, h: 0.25, fontSize: 11, italic: true, color: C.ok });
  T(s, "In both cases the cryptography was sound and the layer around it was not. That is where these systems actually break.",
    { x: 0.5, y: 4.55, w: 9, h: 0.3, fontSize: 12.5, bold: true, italic: true, color: C.accent });
}

/* 11 ---------------------------------------------------------------- what it costs */
{
  const s = slide("What it does not do", "the questions we would ask, answered before you ask them");
  const items = [
    ["A credential is a bearer token", "No device binding: whoever holds the secret is you. WebAuthn PRF is supported on this machine and fixes it in about a day — with zero circuit changes.", C.priv],
    ["The trusted setup is a demo ceremony", "Reproducible entropy, so soundness does not hold against anyone who reconstructs it. A verified 3-contributor ceremony took 14 SECONDS to run, so this is a decision, not an obstacle.", C.priv],
    ["No revocation beyond expiry", "We built it anyway to price it: a sparse-Merkle exclusion proof costs +127% constraints and 2.7× proving. Bounded, not a research problem.", C.priv],
    ["No interoperability", "79% of our circuit is one EdDSA check on the cheapest curve there is. Real issuers sign with P-256, which is ~1.5M constraints. That is a proof-system decision, not a compliance one.", C.bad],
  ];
  items.forEach(([k, v, col], i) => {
    const y = 1.4 + i * 0.93;
    box(s, 0.5, y, 9, 0.83, C.card, C.line);
    T(s, k, { x: 0.75, y: y + 0.11, w: 8.5, h: 0.28, fontSize: 12.5, bold: true, color: col });
    T(s, v, { x: 0.75, y: y + 0.39, w: 8.5, h: 0.4, fontSize: 11, color: C.muted });
  });
  evid(s, "docs/WORTH.md — every gap attempted and measured, not estimated");
}

/* 12 ------------------------------------------------------------------- close */
{
  const s = pres.addSlide(); s.background = { color: C.bg };
  T(s, "Everyone says “trust us, it’s private.”", { x: 0.7, y: 1.5, w: 8.6, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: C.text, valign: "middle" });
  T(s, "VOUCH lets you sit down and try to break it — and tells you where it leaks.", { x: 0.7, y: 2.15, w: 8.6, h: 0.6, fontFace: HEAD, fontSize: 26, color: C.accent, valign: "middle" });
  box(s, 0.7, 3.05, 8.6, 1.1, C.card, C.line2);
  T(s, "./demo.sh", { x: 0.95, y: 3.2, w: 3.0, h: 0.35, fontFace: MONO, fontSize: 15, bold: true, color: C.accent });
  T(s, "58 tests · six acts · 2.5 minutes · nothing pre-recorded. Run it twice and the proofs differ; the verdict does not.",
    { x: 0.95, y: 3.58, w: 8.1, h: 0.5, fontSize: 12.5, color: C.muted });
  T(s, "github.com/devkancheti4-design/vouch-zk-identity      ·      github.com/devkancheti4-design/sovereign-mesh",
    { x: 0.7, y: 4.5, w: 8.6, h: 0.3, fontFace: MONO, fontSize: 10, color: C.muted });
  s.addNotes("Close on the falsifiability, not the feature list. Then offer to run demo.sh.");
}

pres.writeFile({ fileName: "VOUCH-STORY.pptx" }).then(() => console.log("wrote deck/VOUCH-STORY.pptx"));

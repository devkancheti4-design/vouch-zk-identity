import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { getIssuer, requestCredential, type IssuerInfo } from "./lib/api";
import {
  proveClaim, subjectOf, today, fromDays,
  type Credential, type IssuerKey, type Policy, type ProofBundle,
} from "./lib/credential";
import { REGISTRY, deployment, publicClient, short, vouchRegistryAbi, walletFor } from "./lib/chain";
import { HOLDER_WALLET_INDEX, clearWallet, holderSecret, loadCredential, saveCredential } from "./lib/wallet";
import { Home } from "./components/Home";
import { GetVerified } from "./components/GetVerified";
import { Wallet } from "./components/Wallet";
import { Marketplace } from "./components/Marketplace";
import { Audit } from "./components/Audit";
import { Validation } from "./components/Validation";
import { BuiltWith } from "./components/BuiltWith";

export type Page = "home" | "verify" | "wallet" | "shop" | "audit" | "validate" | "built";
export interface PolicyMeta {
  policyId: number; name: string; minAgeDays: number; minBalance: number;
  requireAge: boolean; requireBalance: boolean; requireAccredited: boolean;
}
export interface Shop {
  policyId: number; brand: string; tagline: string; product: string; price: string;
  emoji: string; accent: string; demand: string; afterText: string;
}

export const SHOPS: Shop[] = [
  { policyId: 1, brand: "NightOwl Spirits", tagline: "Independent bottler, since 1994", product: "Islay single malt, 18 year", price: "£128", emoji: "🥃", accent: "#ffb86b", demand: "You must be over 18", afterText: "Age confirmed. Add to basket unlocked — no ID was uploaded, scanned or stored." },
  { policyId: 2, brand: "Meridian Ventures", tagline: "Private allocation round", product: "Series A token allocation", price: "$25,000 min", emoji: "📈", accent: "#63a4ff", demand: "You must be an accredited investor", afterText: "Accreditation confirmed. Allocation page unlocked — your portfolio value was never disclosed." },
  { policyId: 3, brand: "Harbour Lofts", tagline: "Waterside rentals, Bristol", product: "Two-bed loft, Wapping Wharf", price: "£2,400 / month", emoji: "🏙", accent: "#5eead4", demand: "You must hold at least 10,000 in reserves", afterText: "Reserves confirmed. Viewing booked — no bank statement changed hands." },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [issuerInfo, setIssuerInfo] = useState<IssuerInfo>();
  const [issuerErr, setIssuerErr] = useState<string>();
  const [cred, setCred] = useState<Credential | undefined>(() => loadCredential());
  const [secret] = useState<bigint>(() => holderSecret());
  const [clearedMap, setClearedMap] = useState<Record<number, boolean>>({});
  const holderAddr = deployment.holders[HOLDER_WALLET_INDEX - 1] as Address;

  useEffect(() => { getIssuer().then(setIssuerInfo).catch((e) => setIssuerErr(String(e.message ?? e))); }, []);

  const refreshCleared = useCallback(async () => {
    const out: Record<number, boolean> = {};
    for (const p of deployment.policies as PolicyMeta[]) {
      out[p.policyId] = (await publicClient.readContract({
        address: REGISTRY, abi: vouchRegistryAbi, functionName: "isCleared", args: [holderAddr, BigInt(p.policyId)],
      })) as boolean;
    }
    setClearedMap(out);
  }, [holderAddr]);
  useEffect(() => { refreshCleared().catch(() => {}); }, [refreshCleared]);

  const issuerKey: IssuerKey | undefined = issuerInfo
    ? { name: issuerInfo.name, priv: new Uint8Array(), x: issuerInfo.pubX, y: issuerInfo.pubY }
    : undefined;

  const onIssued = (c: Credential) => { saveCredential(c); setCred(c); setPage("wallet"); };
  const onReset = () => { clearWallet(); setCred(undefined); window.location.reload(); };

  const policyFor = (id: number): Policy => {
    const m = (deployment.policies as PolicyMeta[]).find((p) => p.policyId === id)!;
    return {
      policyId: id, name: m.name, nowDays: today(),
      minAgeDays: m.minAgeDays, minBalance: m.minBalance,
      requireAge: m.requireAge, requireBalance: m.requireBalance, requireAccredited: m.requireAccredited,
    };
  };

  /** the whole flow a shop triggers: prove in the browser, then verify on-chain */
  const proveAndClear = async (policyId: number): Promise<{ bundle: ProofBundle; gas: string }> => {
    if (!cred || !issuerKey) throw new Error("no credential in this wallet");
    const bundle = await proveClaim(cred, secret, issuerKey, policyFor(policyId));
    const wc = walletFor(HOLDER_WALLET_INDEX);
    const { a, b, c, pub } = bundle.calldata;
    const hash = await wc.writeContract({
      address: REGISTRY, abi: vouchRegistryAbi, functionName: "clear",
      args: [BigInt(policyId), a, b, c, pub], account: wc.account!, chain: wc.chain,
    });
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error("the registry rejected the proof");
    await refreshCleared();
    return { bundle, gas: r.gasUsed.toString() };
  };

  const nav: [Page, string][] = [
    ["home", "How it works"], ["verify", "Get verified"], ["wallet", "My wallet"],
    ["shop", "Where it's used"], ["validate", "Validation"], ["audit", "What leaks?"], ["built", "How it's built"],
  ];

  return (
    <div className="app">
      <header className="hdr">
        <button className="brand" onClick={() => setPage("home")}>
          <span className="mark">✓</span>
          <span><b>VOUCH</b><small>verify once · prove anywhere · reveal nothing</small></span>
        </button>
        <nav>
          {nav.map(([k, label]) => (
            <button key={k} className={page === k ? "nav on" : "nav"} onClick={() => setPage(k)}>
              {label}{k === "wallet" && cred ? <span className="dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="hdr-right">
          <span className={issuerInfo ? "chip ok" : "chip bad"}>
            {issuerInfo ? `issuer online · ${issuerInfo.issuedCount} issued` : issuerErr ? "issuer offline" : "connecting…"}
          </span>
          <span className="chip">chain {short(REGISTRY, 10)}</span>
        </div>
      </header>

      <main>
        {issuerErr && page === "verify" && (
          <div className="banner">The issuer service is not running. Start it with <span className="mono">cd server &amp;&amp; npm start</span>.</div>
        )}
        {page === "home" && <Home setPage={setPage} hasCred={!!cred} clearedMap={clearedMap} />}
        {page === "verify" && <GetVerified secret={secret} onIssued={onIssued} existing={cred} />}
        {page === "wallet" && <Wallet cred={cred} secret={secret} clearedMap={clearedMap} onReset={onReset} setPage={setPage} />}
        {page === "shop" && <Marketplace cred={cred} clearedMap={clearedMap} proveAndClear={proveAndClear} setPage={setPage} />}
        {page === "audit" && <Audit issuerKey={issuerKey} holderAddr={holderAddr} />}
        {page === "validate" && <Validation issuerKey={issuerKey} holderAddr={holderAddr} />}
        {page === "built" && <BuiltWith />}
      </main>

      <footer>
        <div className="foot-grid">
          <div><b>The credential</b><span>EdDSA over BabyJubJub, signed by the issuer service. Never leaves your browser.</span></div>
          <div><b>The proof</b><span>Groth16 over a 10,273-constraint circom circuit. 9 private inputs, 9 public. Built here, in ~550 ms.</span></div>
          <div><b>The verifier</b><span>A snarkjs-generated Solidity verifier plus a registry that stores one boolean and one nullifier.</span></div>
        </div>
      </footer>
    </div>
  );
}

export { subjectOf, requestCredential, fromDays };

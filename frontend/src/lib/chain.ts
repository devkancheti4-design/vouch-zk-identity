/**
 * The chain layer, which is OPTIONAL by design.
 *
 * The zero-knowledge half of VOUCH — issuing a credential, proving a claim, verifying that proof,
 * and demonstrating that nothing leaks — needs no blockchain at all. It happens in the browser.
 * The chain adds one thing: a public, replay-protected record that somebody qualified.
 *
 * So the app runs in two modes:
 *   • CHAIN ON  — a registry address is configured and reachable. Proofs are also verified
 *                 on-chain and clearance is recorded. Locally that is a Hardhat node with dev
 *                 keys; in a public deployment it is a testnet and the user's own wallet.
 *   • CHAIN OFF — no registry configured. Everything still works, verification is client-side
 *                 only, and the UI says so rather than pretending.
 */
import { createPublicClient, createWalletClient, custom, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import raw from "../generated/deployment.json";
import { vouchRegistryAbi } from "../generated/abis";

const env = import.meta.env as Record<string, string | undefined>;
export const deployment = raw as typeof raw;

const isLocalHost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

/** env wins, then the generated file — but a localhost RPC is useless once deployed */
const RPC = env.VITE_RPC_URL ?? (isLocalHost ? deployment.rpcUrl : undefined);
const REGISTRY_ADDR = (env.VITE_REGISTRY ?? (isLocalHost ? deployment.contracts.registry : undefined)) as Address | undefined;
const CHAIN_ID = Number(env.VITE_CHAIN_ID ?? deployment.chainId ?? 31337);
const CHAIN_NAME = env.VITE_CHAIN_NAME ?? (CHAIN_ID === 31337 ? "Hardhat" : "configured chain");

/** true when the on-chain half of the demo is available */
export const hasChain = Boolean(RPC && REGISTRY_ADDR);
export const isLocal = isLocalHost && hasChain;

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: RPC ? [RPC] : [] } },
});

export const REGISTRY = (REGISTRY_ADDR ?? "0x0000000000000000000000000000000000000000") as Address;
export const publicClient = hasChain ? createPublicClient({ chain, transport: http(RPC) }) : undefined;
export { vouchRegistryAbi };

/** the public Hardhat dev keys — local demo only, they hold nothing on any real network */
export const DEV_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

interface Eip1193 { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }
const injected = (): Eip1193 | undefined => (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;

/**
 * A signer for submitting a proof.
 * Locally that is a dev key. Deployed, it is the visitor's own wallet — VOUCH never holds keys.
 */
export async function signer(devIndex = 1) {
  if (!hasChain) throw new Error("no chain configured");
  if (isLocal) return createWalletClient({ account: privateKeyToAccount(DEV_KEYS[devIndex]), chain, transport: http(RPC) });
  const eth = injected();
  if (!eth) throw new Error("This deployment needs a browser wallet to submit proofs. Install MetaMask, or run the demo locally where dev keys are used.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  return createWalletClient({ account: accounts[0], chain, transport: custom(eth) });
}

/** the address whose clearance the UI shows */
export async function holderAddress(devIndex = 1): Promise<Address | undefined> {
  if (!hasChain) return undefined;
  if (isLocal) return deployment.holders[devIndex - 1] as Address;
  const eth = injected();
  if (!eth) return undefined;
  const accounts = (await eth.request({ method: "eth_accounts" })) as Address[];
  return accounts[0];
}

export const short = (s: string, n = 10) => (s.length > n ? s.slice(0, n) + "…" : s);
export const CHAIN_LABEL = hasChain ? `${CHAIN_NAME} · ${short(REGISTRY, 10)}` : "client-side only";

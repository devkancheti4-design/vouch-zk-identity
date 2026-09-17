import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import deployment from "../generated/deployment.json";
import { vouchRegistryAbi } from "../generated/abis";

export const chain = { ...hardhat, rpcUrls: { default: { http: [deployment.rpcUrl] } } };
export const publicClient = createPublicClient({ chain, transport: http(deployment.rpcUrl) });
export const REGISTRY = deployment.contracts.registry as Address;
export { deployment, vouchRegistryAbi };

/** the public Hardhat dev keys — local demo only, they hold nothing anywhere real */
export const DEV_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];
export const walletFor = (i: number) =>
  createWalletClient({ account: privateKeyToAccount(DEV_KEYS[i]), chain, transport: http(deployment.rpcUrl) });

export const short = (s: string, n = 10) => (s.length > n ? s.slice(0, n) + "…" : s);

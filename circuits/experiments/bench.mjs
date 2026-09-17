import { buildEddsa, buildPoseidon } from "circomlibjs";
import { createHash } from "node:crypto";
import * as snarkjs from "snarkjs";
const eddsa = await buildEddsa(), poseidon = await buildPoseidon(), F = poseidon.F;
const priv = createHash("sha256").update("Demo KYC Provider").digest();
const pub = eddsa.prv2pub(priv);
const secret = 511634828180051440175120251711n;
const attrs = { dobDays: 7318, balance: 250000, countryCode: 826, flags: 1, expiresAt: 21500 };
const subject = F.toObject(poseidon([secret]));
const msg = poseidon([subject, ...[attrs.dobDays,attrs.balance,attrs.countryCode,attrs.flags,attrs.expiresAt].map(BigInt)]);
const sig = eddsa.signPoseidon(priv, msg);
const base = {
  issuerPubX: F.toObject(pub[0]).toString(), issuerPubY: F.toObject(pub[1]).toString(),
  nowDays:"20714", minAgeDays:"6570", minBalance:"10000",
  requireAge:"1", requireBalance:"1", requireAccredited:"1", contextId:"1",
  holderSecret: secret.toString(), dobDays:String(attrs.dobDays), balance:String(attrs.balance),
  countryCode:String(attrs.countryCode), flags:String(attrs.flags), expiresAt:String(attrs.expiresAt),
  sigR8x:F.toObject(sig.R8[0]).toString(), sigR8y:F.toObject(sig.R8[1]).toString(), sigS:sig.S.toString(),
};
const time = async (input, wasm, zkey, n = 7) => {
  const t = [];
  for (let i=0;i<n;i++){ const t0=performance.now(); await snarkjs.groth16.fullProve({...input, contextId:String(i+1)}, wasm, zkey); t.push(performance.now()-t0); }
  t.sort((a,b)=>a-b); return Math.round(t[Math.floor(n/2)]);
};
const b = await time(base, "build/vouch_js/vouch.wasm", "build/vouch_final.zkey");
console.log("base circuit        ", b, "ms   (10,273 constraints)");

// the decentralised one needs the issuer's Merkle path
const H2=(l,r)=>F.toObject(poseidon([l,r]));
const keys=["Demo KYC Provider","Barclays","Deutsche Bank","HDFC","Chase"].map(l=>{const pv=createHash("sha256").update(l).digest();const pb=eddsa.prv2pub(pv);return{x:F.toObject(pb[0]),y:F.toObject(pb[1])};});
let level=keys.map(k=>H2(k.x,k.y)); while(level.length<256) level.push(0n);
const levels=[level]; while(level.length>1){const n=[];for(let i=0;i<level.length;i+=2)n.push(H2(level[i],level[i+1]));levels.push(n);level=n;}
const root=level[0]; const pe=[],pi=[]; let idx=0;
for(let d=0;d<8;d++){pe.push(levels[d][idx^1].toString());pi.push(String(idx&1));idx>>=1;}
const shard={...base, issuerSetRoot:root.toString(), issuerPath:pe, issuerIndices:pi};
delete shard.issuerPubX; delete shard.issuerPubY;
shard.issuerPubX=F.toObject(pub[0]).toString(); shard.issuerPubY=F.toObject(pub[1]).toString();
const s2 = await time(shard, "build/vouch_shard_js/vouch_shard.wasm", "build/shard_final.zkey");
console.log("decentralised issuer", s2, "ms   (14,958 constraints)");
console.log("cost of decentralising:", "+"+(s2-b), "ms", "(+"+Math.round(100*(s2-b)/b)+"%)");
const c=globalThis.curve_bn128; if(c?.terminate) await c.terminate();

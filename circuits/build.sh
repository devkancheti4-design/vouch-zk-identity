#!/usr/bin/env bash
# Compiles the circuit, runs a LOCAL Groth16 setup (demo ceremony, one contributor) and exports
# the verification key and the Solidity verifier. Deterministic entropy so it is reproducible;
# production needs a multi-party ceremony over the same circuit.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

npx circom2 vouch.circom --r1cs --wasm --sym -o build
npx snarkjs r1cs info build/vouch.r1cs

if [ ! -f build/pot14_final.ptau ]; then
  echo "powers of tau (2^14) — one time, a few minutes"
  npx snarkjs powersoftau new bn128 14 build/pot14_0000.ptau -v > /dev/null
  npx snarkjs powersoftau contribute build/pot14_0000.ptau build/pot14_0001.ptau --name="vouch demo" -e="vouch demo entropy 2026-09-17" -v > /dev/null
  npx snarkjs powersoftau prepare phase2 build/pot14_0001.ptau build/pot14_final.ptau -v > /dev/null
fi

npx snarkjs groth16 setup build/vouch.r1cs build/pot14_final.ptau build/vouch_0000.zkey > /dev/null
npx snarkjs zkey contribute build/vouch_0000.zkey build/vouch_final.zkey --name="vouch demo" -e="vouch zkey entropy 2026-09-17" -v > /dev/null
npx snarkjs zkey export verificationkey build/vouch_final.zkey build/verification_key.json
npx snarkjs zkey export solidityverifier build/vouch_final.zkey build/Groth16Verifier.sol
mkdir -p ../contracts/contracts
cp build/Groth16Verifier.sol ../contracts/contracts/Groth16Verifier.sol
echo "built: build/vouch_final.zkey, build/vouch_js/vouch.wasm -> contracts/contracts/Groth16Verifier.sol"

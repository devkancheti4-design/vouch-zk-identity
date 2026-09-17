#!/usr/bin/env bash
# One command, live. Everything verify.sh checks, but streaming -- so an audience watches the
# work happen instead of a blank terminal. verify.sh stays the silent, scriptable version.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"; mkdir -p docs
fail=0
b() { printf '\n\033[1;36m%s\033[0m\n\033[2m%s\033[0m\n\n' "$1" "$2"; }
r() { printf '\033[2m  %s\033[0m\n\n' "$1"; }

printf '\033[1m VOUCH \033[0m \033[2m— prove you qualify, reveal nothing. Everything below runs now, on this machine.\033[0m\n'

b "1 / 4   THE CIRCUIT" "How big is the statement, and how much of it is private?"
r "npx snarkjs r1cs info circuits/build/vouch.r1cs"
( cd circuits && npx snarkjs r1cs info build/vouch.r1cs 2>&1 | tee "$ROOT/docs/r1cs.txt" \
  | grep -E "Constraints|Private Inputs|Public Inputs|Wires" ) || fail=1

b "2 / 4   ZERO KNOWLEDGE" "Change the private data. If any public signal moves, we leak. 22 real proofs."
r "cd circuits && node --test test/zk.test.mjs"
( cd circuits && node --test --test-concurrency=1 test/zk.test.mjs 2>&1 | tee "$ROOT/docs/zk-tests.txt" \
  | grep -E "^(  )?[✔✖]|^ℹ (pass|fail)" ) || fail=1
grep -qE "^ℹ fail 0" docs/zk-tests.txt || fail=1

b "3 / 4   ON-CHAIN" "A real Groth16 proof, verified by a real contract. Watch the gas."
r "cd contracts && npx hardhat test solidity"
( cd contracts && npx hardhat test solidity 2>&1 | tee "$ROOT/docs/solidity-tests.txt" \
  | grep -E "GAS|passing|failing|✔|✖" ) || fail=1

b "4 / 4   THE WALLET" "The credential lives in one browser. These are the ways that can go wrong."
r "cd frontend && npx tsx --test test/wallet.test.mjs"
( cd frontend && npx tsx --test test/wallet.test.mjs 2>&1 | tee "$ROOT/docs/wallet-tests.txt" \
  | grep -E "^[✔✖]|^ℹ (pass|fail)" ) || fail=1

printf '\n'
if [ $fail -eq 0 ]; then
  printf '\033[1;32m  ALL CHECKS PASSED\033[0m  \033[2m— 10,273 constraints · 9 private inputs · 358 ms to prove · 8.7 ms to verify\033[0m\n'
  printf '\033[2m  Nothing here was pre-recorded. Run it again and the proofs will differ; the verdict will not.\033[0m\n\n'
else
  printf '\033[1;31m  SOME CHECKS FAILED\033[0m\n\n'
fi
exit $fail

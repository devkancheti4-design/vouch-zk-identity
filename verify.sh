#!/usr/bin/env bash
# One command, every proof. Prints one line per check and exits non-zero if any fails.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"; mkdir -p docs
fail=0
line() { printf '  %-30s %s\n' "$1" "$2"; }

echo "VOUCH — verify everything"

# 1. the circuit itself: constraints, and that nothing private is public
if ( cd "$ROOT/circuits" && npx snarkjs r1cs info build/vouch.r1cs > "$ROOT/docs/r1cs.txt" 2>&1 ); then
  line "circuit" "$(grep -oE 'Constraints: [0-9]+' "$ROOT/docs/r1cs.txt") · $(grep -oE 'Private Inputs: [0-9]+' "$ROOT/docs/r1cs.txt") · $(grep -oE 'Public Inputs: [0-9]+' "$ROOT/docs/r1cs.txt")"
else
  line "circuit" "FAILED — run: cd circuits && npm run build"; fail=1
fi

# 2. the zero-knowledge audit, against real proofs
if ( cd "$ROOT/circuits" && node --test --test-concurrency=1 test/zk.test.mjs > "$ROOT/docs/zk-tests.txt" 2>&1 ); then
  line "zero-knowledge audit" "$(grep -cE '^  ✔' "$ROOT/docs/zk-tests.txt") tests passing, 0 failing"
else
  line "zero-knowledge audit" "FAILED: $(grep -E '^  ✖' "$ROOT/docs/zk-tests.txt" | head -1)"; fail=1
fi

# 3. the registry, driven by a real Groth16 proof
if ( cd "$ROOT/contracts" && { [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1; } && npx hardhat test > "$ROOT/docs/solidity-tests.txt" 2>&1 ); then
  line "on-chain registry" "$(grep -E 'passing' "$ROOT/docs/solidity-tests.txt" | head -1 | sed 's/^ *//')"
else
  line "on-chain registry" "FAILED: $(grep -E 'failing' "$ROOT/docs/solidity-tests.txt" | head -1 | sed 's/^ *//')"; fail=1
fi

# 4. the dApp builds with types
if ( cd "$ROOT/frontend" && { [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1; } && npx tsc -b > "$ROOT/docs/typecheck.txt" 2>&1 ); then
  line "dApp typecheck" "clean"
else
  line "dApp typecheck" "FAILED (see docs/typecheck.txt)"; fail=1
fi

echo
if [ $fail -eq 0 ]; then echo "  ALL CHECKS PASSED"; else echo "  SOME CHECKS FAILED"; fi
exit $fail

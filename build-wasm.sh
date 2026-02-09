#!/bin/bash
# Build all nbsdgames to WASM using Emscripten.
# Usage: ./build-wasm.sh
# Or via Docker: docker build -t copilot-fun-build . && docker run --rm -v $(pwd)/wasm:/build/wasm copilot-fun-build

set -e

COMMON_FLAGS="-O2 -I wasm -I nbsdgames -DNO_MOUSE -DNO_VLA -D__unix__"
ASYNC_FLAGS="-s ASYNCIFY=1 -s ASYNCIFY_IMPORTS=[\"em_getch\"]"
ENV_FLAGS="-s ENVIRONMENT=node -s EXIT_RUNTIME=1 -s FORCE_FILESYSTEM=1 -s NODERAWFS=1"
JS_LIB="--js-library wasm/term_input.js"

# Games that compile successfully (trsr has source bug with NO_VLA)
GAMES="battleship checkers darrt fifteen fisher jewels memoblocks miketron mines muncher pipes rabbithole redsquare revenge reversi sjump snakeduel sos sudoku"

FAILED=""
BUILT=0

for game in $GAMES; do
  src="nbsdgames/${game}.c"
  out="wasm/${game}.js"
  if [ ! -f "$src" ]; then
    echo "SKIP: $src not found"
    continue
  fi
  echo "Building $game..."
  if emcc $COMMON_FLAGS $ASYNC_FLAGS $ENV_FLAGS $JS_LIB -lm -o "$out" "$src" 2>&1; then
    BUILT=$((BUILT + 1))
    echo "  OK: $game"
  else
    FAILED="$FAILED $game"
    echo "  FAIL: $game"
  fi
done

echo ""
echo "Built: $BUILT games"
[ -n "$FAILED" ] && echo "Failed:$FAILED" || echo "All games compiled successfully!"

# Copilot Instructions — copilot-fun

## Architecture

This is a single-file Node.js TUI application (`index.js`, ~760 lines) that wraps GitHub Copilot CLI in a pseudo-terminal multiplexer. It manages three screens — **copilot**, **game menu**, and **game** — switching between them while preserving state for both.

### Core loop

1. **Copilot CLI** runs in a `node-pty` PTY. Its output is written to an `@xterm/headless` virtual terminal (`vterm`) that records screen state even when the copilot screen is hidden.
2. **Games** run in a second PTY with their own virtual terminal (`gameVterm`).
3. **Screen switching** serializes the hidden vterm back to ANSI escape sequences (`serializeVTerm()`) and writes them to stdout, reproducing the screen pixel-perfectly — similar to how tmux works.
4. A **status bar** on the last row persists across all screens. It's drawn outside the scroll region (`setScrollRegion()` reserves the last row). The `getStatusBarSequence()` function returns the ANSI string; `drawStatusBar()` and `scheduleStatusBarRedraw()` handle writing with 80ms debounce to prevent flicker.
5. **Copilot status** (`idle`/`working`/`waiting`) is tracked via file-based hooks (`.github/hooks/copilot-fun.json`) that Copilot CLI triggers on prompt submit, tool use, etc. The wrapper polls `~/.copilot-fun/status` every 1 second.

### Game types

- **WASM games** (`type: 'wasm'`): C games from nbsdgames compiled to WebAssembly via Emscripten. Located in `wasm/`. Use a custom ncurses shim (`wasm/curses.h`) and async stdin bridge (`wasm/term_input.js`).
- **Built-in JS games** (`type: 'js'`): Located in `games/` as `<id>.json` + `<id>.js` pairs.
- **Custom JS games** (`type: 'js'`): Single `.js` files in `~/.copilot-fun/games/` with `// @game.*` header comments for metadata. Zero-dependency, standalone Node.js scripts.

### Key conventions

- **ANSI escape codes are built manually** — no chalk/blessed/ink. Constants like `CSI`, `BOLD`, `RESET`, `BG_BLUE` are defined at the top of `index.js`.
- **All rendering goes through `process.stdout.write()`** with raw escape sequences. Status bar output is concatenated atomically with screen content (e.g. `data + getStatusBarSequence()`) to avoid partial-draw artifacts.
- **Input is parsed as raw bytes** from `process.stdin` in raw mode. Key codes are matched by byte values (e.g. `0x07` = Ctrl-G, `0x13` = Ctrl-S, `0x1b` = ESC).
- **JSDoc `@type` annotations** are used throughout (with `// @ts-check`) instead of TypeScript. Keep this pattern.
- **No test suite or linter** exists. Validate with `node -c index.js` for syntax checking.
- **Single-file architecture** — the entire application logic is in `index.js`. Avoid splitting into modules unless explicitly asked.

## Commands

```bash
npm start          # Run the app (node index.js)
node -c index.js   # Syntax check
```

### WASM compilation (rarely needed — pre-compiled binaries are committed)

```bash
# Docker build (recommended)
docker build -t copilot-fun-build .
docker run --rm -v $(pwd)/wasm:/build/wasm copilot-fun-build

# Single game
emcc -O2 -I wasm -I nbsdgames -DNO_MOUSE -DNO_VLA -D__unix__ \
  -s ASYNCIFY=1 -s 'ASYNCIFY_IMPORTS=["em_getch"]' \
  -s ENVIRONMENT=node -s EXIT_RUNTIME=1 \
  -s FORCE_FILESYSTEM=1 -s NODERAWFS=1 \
  --js-library wasm/term_input.js -lm -o wasm/<game>.js nbsdgames/<game>.c
```

## Adding a custom JS game

Create `~/.copilot-fun/games/<id>.js` with metadata header:

```js
// @game.id pong
// @game.name Pong
// @game.desc Classic paddle ball game
// @game.controls W/S to move paddle
// @game.goal Score more points than the opponent
// @game.similar Pong (Atari)
```

The game runs as `node <file>`, receives `LINES`/`COLS` env vars, must use raw stdin and ANSI stdout, and must not handle `q`/`ESC` (the wrapper intercepts those to quit). See `.github/prompts/copilot-fun-add-game.md` for the full spec and templates.

## Screen management gotchas

- The last terminal row is reserved for the status bar via `setScrollRegion()`. Games and copilot PTYs are sized to `rows - 1`.
- When switching screens, PTYs are briefly resized (cols - 10, then restored) to force child processes to redraw — a plain resize to the same dimensions is a no-op for many programs.
- `drawStatusBar()` prepends `RESET` before `CSI s` (cursor save) to prevent corrupting in-progress escape sequences from game/copilot output.
- Auto-switch mode (`Ctrl-S`) toggles between copilot and game screens based on AI working/idle status. This is driven by `handleAutoSwitch()` called from `pollCopilotStatus()`.

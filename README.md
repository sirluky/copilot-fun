# 🎮 Copilot Fun Mode

A TUI wrapper around [GitHub Copilot CLI](https://github.com/github/copilot-cli) that lets you play terminal games while your AI codes.

Press **Ctrl-G** to toggle between Copilot and a game menu with 13 games. Switch back anytime — both your Copilot session and game progress are preserved. Enable **Ctrl-S** auto-switch mode to automatically toggle screens based on AI activity.

![Copilot Fun Mode](copilot-fun.gif)

## Features

- **Seamless screen switching** — toggle between Copilot and games with `Ctrl-G`, like a terminal multiplexer
- **Auto-switch mode** — press `Ctrl-S` to automatically switch to games when AI is working, back to Copilot when it needs input
- **Game state preservation** — pause mid-game, check Copilot, resume exactly where you left off
- **Copilot status tracking** — status bar shows whether AI is working, waiting for input, or idle (via [Copilot Hooks](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-hooks))
- **13 turn-based games** — 10 WASM games compiled from [nbsdgames](https://github.com/abakh/nbsdgames), plus 3 built-in JS games (2048, Cookie Clicker, Tic-Tac-Toe)
- **Custom games support** — add your own games as single-file Node.js scripts in `~/.copilot-fun/games/`
- **Cross-platform** — no tmux, no native binaries, just Node.js

## Installation

### Prerequisites

- **Node.js** 18+ (tested with v23.4.0)
- **GitHub Copilot CLI** installed:
  ```bash
  npm install -g @github/copilot-cli
  ```

### Option 1: npx (Quickest)

Run directly without installation:

```bash
npx copilot-fun
```

Pass Copilot CLI arguments:

```bash
npx copilot-fun --model claude-sonnet-4.5
```

### Option 2: npm Global Install (Recommended)

Install globally for easier access:

```bash
npm install -g copilot-fun
copilot-fun
```
### Option 3: Manual Installation (For Development)

```bash
# Clone the repository
git clone https://github.com/sirluky/copilot-fun.git
cd copilot-fun
npm install

# Link globally
npm link

# Run
copilot-fun
```

## Controls

### Global

| Key | Action |
|-----|--------|
| Ctrl-G | Toggle between Copilot and Game Menu |
| Ctrl-S | Toggle auto-switch mode (auto-switch between Copilot and games based on AI activity) |

### Game Menu

| Key | Action |
|-----|--------|
| ↑↓ / W/S / J/K | Navigate game list |
| Enter | Launch game (or resume paused game) |
| N | Start new game (replaces any paused game) |
| Q | Return to Copilot |

### In-Game

| Key | Action |
|-----|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| Enter | Confirm / act |
| Ctrl-G | Pause game, return to menu |
| Q | Quit game |

See [GAMES.md](GAMES.md) for per-game controls and rules.

## Games

All games are turn-based — perfect for playing while waiting for Copilot responses.

### Built-in Games

| Game | Description | Similar to |
|------|-------------|------------|
| Fifteen Puzzle | Slide tiles into order | 15-Puzzle |
| Mines | Classic minesweeper | Minesweeper |
| Sudoku | Number placement puzzle | Sudoku |
| Reversi | Disc-flipping strategy | Othello |
| Checkers | Diagonal capture game | Draughts |
| SOS | Letter placement strategy | Tic-Tac-Toe (ext.) |
| Battleship | Naval combat guessing | Battleship |
| Memoblocks | Memory matching cards | Concentration |
| Rabbit Hole | Maze navigation | Maze Runner |
| Revenge | Block-pushing puzzles | Sokoban |
| 2048 | Slide tiles to create 2048 | 2048 (Gabriele Cirulli) |
| Cookie Clicker | Click cookies, buy upgrades | Cookie Clicker |
| Tic-Tac-Toe | Classic 3x3 game | Tic-Tac-Toe |

### Custom Games

You can add your own games as single-file Node.js scripts. Create a `~/.copilot-fun/games/` directory and add `.js` files with metadata headers.

Custom games will automatically appear in the game menu.

#### Creating a Custom Game

1. **Create the games directory**:
   ```bash
   mkdir -p ~/.copilot-fun/games
   ```

2. **Add a game file** (e.g., `~/.copilot-fun/games/my-game.js`) with metadata:
   ```javascript
   // @game.id my-game
   // @game.name My Game
   // @game.desc A short description
   // @game.controls Arrow keys to move
   // @game.goal Win the game

   // Your game code here...
   ```

3. **Requirements**:
   - Must be a single `.js` file (Node.js).
   - Use `process.env.LINES` and `process.env.COLS` for terminal size.
   - Use raw ANSI escape codes for rendering.
   - Do **not** handle `q` or `ESC` (the wrapper intercepts these).

See the [Custom Games section in GAMES.md](GAMES.md#adding-custom-games) for a full template and detailed guide.

## How It Works

```
┌─────────────────────────────────────────┐
│  Your Terminal                          │
│  ┌───────────────────────────────────┐  │
│  │  index.js (wrapper)               │  │
│  │                                   │  │
│  │  ┌─────────────┐  ┌───────────┐   │  │
│  │  │ Copilot PTY │  │ Game PTY  │   │  │
│  │  │ + VTerminal │  │ + VTerm   │   │  │
│  │  └─────────────┘  └───────────┘   │  │
│  │                                   │  │
│  │  [Status Bar: AI working/idle]    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

1. **Copilot CLI** runs inside a pseudo-terminal (`node-pty`)
2. **@xterm/headless** virtual terminals track screen state for both Copilot and games (like tmux does internally)
3. **Ctrl-G** switches which screen is rendered — the inactive process keeps running and its VTerminal keeps recording output
4. **Ctrl-S** enables auto-switch mode — automatically switches to games when AI is working autonomously, back to Copilot when it needs input
5. **Copilot Hooks** write status to a file, polled every second by the wrapper to update the status bar and drive auto-switch
6. **WASM games** run in their own PTY via Node.js — compiled from C with a custom ncurses shim
7. **JS games** run as Node.js child processes with raw terminal I/O

## Compiling WASM Games

Pre-compiled `.js` + `.wasm` files are included in `wasm/`. If you want to recompile:

First clone the original C source code for the games:
```bash
git clone https://github.com/abakh/nbsdgames.git nbsdgames
```

### With Docker (recommended)

```bash
docker build -t copilot-fun-build .
docker run --rm -v $(pwd)/wasm:/build/wasm copilot-fun-build
```

### Manually (requires Emscripten)

```bash
# Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source emsdk_env.sh
cd ..

# Build all games
./build-wasm.sh
```

### Build a single game

```bash
source /path/to/emsdk/emsdk_env.sh

emcc -O2 -I wasm -I nbsdgames \
  -DNO_MOUSE -DNO_VLA -D__unix__ \
  -s ASYNCIFY=1 -s 'ASYNCIFY_IMPORTS=["em_getch"]' \
  -s ENVIRONMENT=node -s EXIT_RUNTIME=1 \
  -s FORCE_FILESYSTEM=1 -s NODERAWFS=1 \
  --js-library wasm/term_input.js \
  -lm -o wasm/mines.js nbsdgames/mines.c
```

### WASM Compilation Notes

- **`ASYNCIFY`** is required — `getch()` in C blocks, but JS stdin is async. Asyncify bridges the gap.
- **`FORCE_FILESYSTEM=1 NODERAWFS=1`** — without these, Emscripten's `printChar` only flushes on newline, breaking ANSI escape code output.
- **`wasm/curses.h`** — a ~370-line ncurses shim mapping all curses calls to ANSI escape codes.
- **`wasm/term_input.js`** — Emscripten JS library providing `em_getch()` with raw terminal input, CR→LF translation, and arrow key parsing.
- **`trsr` is excluded** — has a source bug (variables declared inside `#ifndef NO_VLA` but used outside it).

## Project Structure

```
copilot-fun/
├── index.js           # Main TUI wrapper (~918 lines)
├── package.json       # node-pty + @xterm/headless deps
├── Dockerfile         # Docker-based WASM compilation
├── build-wasm.sh      # Build script for all games
├── wasm/
│   ├── curses.h       # ncurses → ANSI shim for Emscripten
│   ├── term_input.js  # Emscripten JS library for terminal input
│   ├── mines.js       # Compiled game (JS loader)
│   ├── mines.wasm     # Compiled game (WASM binary)
│   └── ...            # Other compiled games
├── games/             # Built-in JS games
│   ├── 2048.js        # 2048 game implementation
│   ├── 2048.json      # 2048 game metadata
│   ├── cookie-clicker.js
│   ├── cookie-clicker.json
│   ├── tictactoe.js
│   ├── tictactoe.json
│   └── README.md      # Guide for adding JS games
├── .github/
│   ├── hooks/         # Copilot CLI hooks
│   │   └── copilot-fun.json  # Hook configuration
│   └── prompts/       # Agent prompts
│       └── copilot-fun-add-game.md  # Custom game creation guide
├── nbsdgames/         # Original C source (git submodule / clone)
├── GAMES.md           # Per-game controls and rules
├── LICENSE            # MIT + CC0 (for nbsdgames)
└── POST.md            # dev.to blog post
```

### User Data Directory

The wrapper creates a `~/.copilot-fun/` directory for runtime data:

```
~/.copilot-fun/
├── games/             # Custom user games (single .js files)
├── status             # Copilot status file (idle/working/waiting)
└── hooks-debug.log    # Hook debugging output
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `COPILOT_BIN` | `copilot` | Path to Copilot CLI binary |

## Built With

- [GitHub Copilot CLI](https://github.com/github/copilot-cli) — the AI being wrapped
- [node-pty](https://github.com/nicknisi/node-pty) — pseudo-terminal for spawning Copilot & games
- [@xterm/headless](https://github.com/xtermjs/xterm.js) — virtual terminal for screen state tracking
- [Emscripten](https://emscripten.org/) — C-to-WASM compiler
- [nbsdgames](https://github.com/abakh/nbsdgames) — original C terminal games (CC0)

**Built entirely using Copilot CLI & Me** — an AI building its own entertainment system.

## License

MIT — see [LICENSE](LICENSE).
Games from nbsdgames are CC0 public domain.

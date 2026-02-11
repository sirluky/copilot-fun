---
title: "Copilot Fun Mode — Play Games While Your AI Codes 🎮"
published: false
description: "I built a TUI wrapper around GitHub Copilot CLI that lets you play WASM-compiled terminal games while waiting for your AI. Built entirely with Copilot CLI."
tags: copilot, cli, tui, nodejs
cover_image:
---

## You Know That Feeling

Using TUI tools is great, but we often tend to switch back to the browser when we finish our prompt. Most of the time it's awesome to watch your virtual brain thinking and doing stuff — managing multiple agent sessions, approving tool calls. But sometimes, you just want to **VibeCode**.

For that I decided to create a wrapper around GitHub Copilot CLI, called **Copilot Fun Mode**.

And how did I build it? **Completely coded using Copilot CLI** with a combination of GPT-5.2 and Opus 4.6 models.

<!-- HERE VIDEO / ASCIINEMA SNIPPET -->

## And What Game We Gonna Play?

We have multiple options for turn-based games: Tic-Tac-Toe, Go, Chess, Pexeso (let's see what you remember after giving your AGI the next prompt 😄).

For those games I decided to use existing ones. "Find TUI games, nodejs, my AGI..."

I found [nbsdgames](https://github.com/abakh/nbsdgames) — a collection of 23 terminal games written in C using ncurses. Perfect. But we wanted cross-platform compatibility without requiring users to compile C code...

### The WASM Twist

So I compiled the games to **WebAssembly** using Emscripten. No native binaries, no C compiler needed on the user's machine. Just `node` and you're playing Minesweeper while your AI refactors your codebase.

The hardest part? **ncurses doesn't exist in WASM.** I had to write a complete ncurses shim (~370 lines) that maps all curses functions to ANSI escape codes:

```c
// wasm/curses.h — the ncurses-to-ANSI bridge
static WINDOW* initscr(void) {
    em_setup_term();                // init JS key parser
    _emit("\033[?1049h");           // alt screen buffer
    _emit("\033[2J\033[H");         // clear + home
    return stdscr;
}

static int getch(void) {
    return em_getch(timeout);       // async stdin via ASYNCIFY
}
```

Input was trickier — C's `getch()` blocks, but JavaScript stdin is async. Emscripten's **ASYNCIFY** bridges this gap, suspending the WASM execution while we await a keypress. And since PTY raw mode sends `\r` instead of `\n`, the shim translates CR→LF so games that check for `'\n'` work correctly.

## You Are Maybe Asking, How Could This Work?

Again, it's a wrapper — a wrapper around Copilot CLI + [Copilot Hooks](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-hooks), so you can execute commands after any action your agent takes.

### Could We Integrate Straight Into the TUI?

No. There are no hooks for that and currently, so instead I decided to make a "wrapper" around it. I thought how hard could be ember terminal inside terminal app. Ehh I was wrong, you have to do multiplexer stuffs I know nothing about. But newly released Opus 4.6 knew what to do with it. It perfect like tmux, I also had to do some quircks that forces rerendering of copilot gui during switching from gaming mode, but it seems to be atleast somewhat "ok".

How we will handle in which state copilot is in, and does it need inpput?
So I asked Copilot to explore the [Copilot CLI documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/). And we found something — we can use GitHub CLI hooks to track what the AI is doing: and let copilot implmeent it

```json
{
  "hooks": {
    "userPromptSubmitted": [{ "bash": "echo working > .copilot-fun-status" }],
    "postToolUse": [{ "bash": "echo waiting > .copilot-fun-status" }]
  }
}
```

The wrapper polls this file and shows the AI status in a persistent status bar — **⟳ AI working**, **● Needs input**, or **○ Idle** — visible whether you're in Copilot, the game menu, or mid-game.

### But for the Interface?

We can't simply use Copilot because we want to toggle between a "gaming TUI screen" and the "copilot screen." I was thinking about tmux, but that's problematic because it doesn't run on Windows. I wanted something cross-platform that runs in the same process.

## The Solution: Virtual Terminals (Like tmux, But In-Process)

The key insight came from how tmux actually works internally. It doesn't use ANSI alternate screen buffers to switch panes — it maintains a **virtual terminal** for each pane and renders whichever is active.

I use **@xterm/headless** (the same xterm.js that powers VS Code's terminal, but without the DOM) to track screen state:

```
┌─────────────────────────────────────────┐
│  Your Terminal                          │
│  ┌───────────────────────────────────┐  │
│  │  copilot-fun (wrapper)            │  │
│  │                                   │  │
│  │  ┌─────────────┐  ┌───────────┐   │  │
│  │  │ Copilot PTY │  │ Game PTY  │   │  │
│  │  │ + VTerminal │  │ + VTerm   │   │  │
│  │  └─────────────┘  └───────────┘   │  │
│  │                                   │  │
│  │  [Status Bar: ⟳ AI working]       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Both** Copilot and the game run in their own PTY with a headless VTerminal recording every byte of output. When you press Ctrl-G to switch, the wrapper reads the VTerminal buffer cell-by-cell and replays the exact screen state — colors, attributes, cursor position — just like tmux does.

```javascript
function serializeVTerm(term) {
  const buf = term.buffer.active;
  let out = CLEAR;
  for (let y = 0; y < term.rows; y++) {
    const line = buf.getLine(y);
    for (let x = 0; x < term.cols; x++) {
      const cell = line.getCell(x);
      // reconstruct ANSI sequences for fg, bg, bold, dim, etc.
      out += buildAnsi(cell) + cell.getChars();
    }
  }
  out += `\x1b[${buf.cursorY+1};${buf.cursorX+1}H`; // restore cursor
  return out;
}
```

This means:
- ✅ Cross-platform (Windows, macOS, Linux via node-pty)
- ✅ Same process, no tmux needed
- ✅ Copilot session fully preserved (history, colors, scrollback)
- ✅ Game state preserved on pause/resume
- ✅ Single `npm install` and you're running

## Running It

```bash
git clone <repo-url>
cd copilot-fun
npm install && npm link

# Launch!
copilot-cli

# Or with model selection
copilot-cli --model claude-sonnet-4.5
```

**Controls:**
- **Ctrl-G** — Toggle between Copilot ↔ Game Menu
- **↑↓ / W/S** — Navigate games
- **Enter** — Play (or resume paused game)
- **Ctrl-G in-game** — Pause and return to menu
- **Q** — Quit game / return to Copilot

### 10 Turn-Based Games

All compiled from C to WASM — no native dependencies:

| Game | Like... |
|------|---------|
| 💣 Mines | Minesweeper |
| 🧩 Sudoku | Sudoku |
| 🔢 Fifteen | 15-Puzzle |
| ⚫ Reversi | Othello |
| 🏁 Checkers | Draughts |
| 🎯 SOS | Tic-Tac-Toe (ext.) |
| 🚢 Battleship | Battleship |
| 🃏 Memoblocks | Concentration |
| 🐇 Rabbit Hole | Maze Runner |
| 📦 Revenge | Sokoban |

## The Build Pipeline

Compiling C ncurses games to WASM that run in a Node.js terminal — there's not exactly a tutorial for that. Here's what made it work:

### 1. ncurses Shim (`wasm/curses.h`)

370 lines replacing every ncurses function with ANSI escape code equivalents. `initscr()` enters alt screen, `mvaddch()` moves the cursor, `attron(COLOR_PAIR(n))` maps to `\033[3Xm`. No actual ncurses library involved.

### 2. Async Input Bridge (`wasm/term_input.js`)

An Emscripten JS library that provides `em_getch()`. It puts stdin in raw mode, parses arrow key escape sequences into ncurses constants (`KEY_UP = 0x103`), and uses ASYNCIFY to let the C code block on input while JavaScript handles it asynchronously.

### 3. The Emscripten Flags That Matter

```bash
emcc -O2 \
  -s ASYNCIFY=1 \                    # C getch() can "block"
  -s ASYNCIFY_IMPORTS=["em_getch"] \ # our JS function suspends WASM
  -s FORCE_FILESYSTEM=1 \            # need this for proper stdout
  -s NODERAWFS=1 \                   # use Node's fs directly
  -s ENVIRONMENT=node \              # no browser, no web worker
  --js-library wasm/term_input.js    # inject our input bridge
```

Without `FORCE_FILESYSTEM=1 NODERAWFS=1`, Emscripten's default `printChar` only flushes on newline — which completely breaks ANSI escape code output. That one took a while to figure out.

### Docker Compilation

```bash
docker build -t copilot-fun-build .
docker run --rm -v $(pwd)/wasm:/build/wasm copilot-fun-build
```

Or just run `./build-wasm.sh` if you have Emscripten installed locally.

## Alternatives Considered

Here's a breakdown of approaches I evaluated:

### tmux / Screen (Rejected)
Battle-tested multiplexer, but not cross-platform — no native Windows support. We need something in-process.

### blessed (Rejected)
Rich Node.js TUI library, but `blessed.terminal` requires deprecated `term.js`. Project unmaintained since 2015. Same issue with forks (neo-blessed, @pm2/blessed).

### Ink (Rejected)
React for CLI — great paradigm, but can't embed a raw PTY stream in a React component tree. Wrong abstraction level for wrapping an existing terminal program.

### terminal-kit (Considered)
Rich terminal manipulation, but its abstraction layer fights with raw PTY passthrough. Viable but unnecessary overhead.

### node-pty + ANSI alt screen (Tried, then outgrew)
My first approach: use `\x1b[?1049h/l` to save/restore screens. Simple and elegant — until it broke because Copilot CLI uses alt screen buffers itself. Nested alt screens don't work.

### node-pty + @xterm/headless ✅ (Final)
The tmux approach: headless virtual terminals tracking screen state, cell-by-cell serialization on switch. Two dependencies (`node-pty` + `@xterm/headless`), full control, and it actually works with Copilot's complex terminal output.

### Language alternatives
**Python (Textual)** — gorgeous TUIs, but different ecosystem. **Go (bubbletea)** — single-binary advantage, strong alternative. If building for distribution, I'd seriously consider bubbletea.

## What I Learned

1. **Alternate screen buffers nest poorly.** If your wrapped application uses `?1049h` internally (Copilot does), you can't use it for your own screen switching. Virtual terminals solve this.

2. **WASM + terminal I/O is uncharted territory.** There's no ncurses for WASM, no tutorials, no Stack Overflow answers. You have to build the bridge yourself.

3. **PTY raw mode sends `\r`, games expect `\n`.** A single byte translation (`13 → 10`) fixed controls in all 10 games. Took hours to diagnose.

4. **Copilot CLI enables focus reporting** (`\x1b[?1004h`), producing `ESC[I` and `ESC[O` events that appear as `^[[I^[[O` artifacts. Disable it, strip it, filter it.

5. **Emscripten's stdout buffering is line-based by default.** Without `NODERAWFS`, partial ANSI sequences get buffered and the terminal shows garbage. `FORCE_FILESYSTEM=1` fixes it but it's nowhere in the docs.

## Conclusion

I built a terminal multiplexer that doesn't need tmux, a ncurses implementation that doesn't need ncurses, and a cross-platform game bundle that runs anywhere Node.js does.

The entire wrapper is ~450 lines, has two dependencies, and was built entirely using the tool it wraps.

**Built with ❤️ using Copilot CLI** — an AI building its own entertainment system. How meta is that?

---

*Check out the [GitHub repository](https://github.com/user/copilot-fun) for the full source code and [GAMES.md](https://github.com/user/copilot-fun/blob/main/GAMES.md) for detailed game guides.*

Weird thing about copilot hooks that you cannot found on the internet. I categorited states that make ui interactive and that ones that are not interactive:

{
  "version": 1,
  "hooks": {
    "sessionStart": [...], - non interactive, starts working
    "sessionEnd": [...], - interactive work ended
    "userPromptSubmitted": [...], - non interactive, starts working
    "preToolUse": [...], - needs allow tool
    "postToolUse": [...], - tool call done
    "errorOccurred": [...] - we dont need this
  }
}

But accually pretooluse and posttooluse are diferrent. To understand it i asked copilot cli to add logging to copilot hooks and went through it.




(base) lukas@DESKTOP-368V4I9:~/.copilot-fun$ tail hooks-debug.log  -f
[2026-02-11T18:02:29Z] userPromptSubmitted
[2026-02-11T18:02:29Z] sessionStart
[2026-02-11T18:02:52Z] preToolUse
[2026-02-11T18:02:52Z] preToolUse
[2026-02-11T18:02:52Z] preToolUse
[2026-02-11T18:02:52Z] postToolUse
[2026-02-11T18:02:52Z] postToolUse
[2026-02-11T18:03:02Z] postToolUse
[2026-02-11T18:03:21Z] preToolUse
[2026-02-11T18:03:21Z] postToolUse
[2026-02-11T18:03:39Z] preToolUse
[2026-02-11T18:03:42Z] postToolUse
[2026-02-11T18:04:05Z] preToolUse
[2026-02-11T18:04:05Z] postToolUse
[2026-02-11T18:04:08Z] preToolUse
[2026-02-11T18:04:18Z] postToolUse
[2026-02-11T18:04:22Z] sessionEnd

Accually pretoolUse when requires permission gets called immediately twice and immideately then postTooluse, but not the second one, we can track this and know when all tool use are resolved. So we had to work around it. Great is that as i am writing this post, i can copy this problem and copilot-cli (fun mode) fixes that for me :-D.
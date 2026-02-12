---
title: "Copilot Fun Mode — Play Games While Your AI Codes 🎮"
description: "I built a TUI wrapper around GitHub Copilot CLI that lets you play WASM-compiled terminal games while waiting for your AI. Built entirely with Copilot CLI."
tags: copilot, cli, tui, nodejs
---

*This is a submission for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21)*

## What I Built

Using TUI tools is great, but we often tend to switch back to the browser when we finish our prompt. Most of the time it's awesome to watch your virtual brain thinking and doing stuff — managing multiple agent sessions, approving tool calls. But sometimes, you just want to **VibeCode**.

I decided to create a wrapper around GitHub Copilot CLI, called **Copilot Fun Mode**. It's a cross-platform TUI multiplexer that hosts a Copilot session in one "window" and a suite of terminal games in another. 

### Key Features

- **Seamless Multiplexing**: Toggle between the AI and games instantly with **Ctrl-G**.
- **Auto-Switch Mode**: Press **Ctrl-S** to automatically flip to a game when the AI starts working autonomously, and flip back to Copilot the second it needs your input. 
- **Game State Preservation**: Pause a game, jump back to refactor your code, and resume exactly where you left off.
- **WASM & JS Games**: Includes 10 games compiled from C to WebAssembly, plus 3 built-in JS classics.
- **Extensible**: Add your own games as simple Node.js scripts.

### The Game Library

| Game | Type | Description | Similar to |
|------|------|-------------|------------|
| 🧩 **Fifteen Puzzle** | WASM | Slide numbered tiles into order | 15-Puzzle |
| 💣 **Mines** | WASM | Classic minesweeper | Minesweeper |
| 🧩 **Sudoku** | WASM | Number placement logic puzzle | Sudoku |
| ⚫ **Reversi** | WASM | Strategic disc-flipping board game | Othello |
| 🏁 **Checkers** | WASM | Classic diagonal capture game | Draughts |
| 🎯 **SOS** | WASM | Letter placement strategy game | Tic-Tac-Toe (ext.) |
| 🚢 **Battleship** | WASM | Naval combat guessing game | Battleship |
| 🃏 **Memoblocks** | WASM | Memory matching card game | Concentration |
| 🐇 **Rabbit Hole** | WASM | Maze navigation puzzle | Maze Runner |
| 📦 **Revenge** | WASM | Block-pushing puzzle game | Sokoban |
| 🔢 **2048** | JS | Slide tiles to reach 2048 | 2048 |
| 🍪 **Cookie Clicker** | JS | The ultimate clicking distraction | Cookie Clicker |
| ⭕ **Tic-Tac-Toe** | JS | Classic 3x3 game | Tic-Tac-Toe |

## Demo

![Copilot Fun Mode](copilot-fun.gif)

*   **GitHub Repository**: [sirluky/copilot-fun](https://github.com/sirluky/copilot-fun)
*   **Detailed Game Guides**: [GAMES.md](https://github.com/sirluky/copilot-fun/blob/main/GAMES.md)

### Quick Start

```bash
npx copilot-fun
```

## My Experience with GitHub Copilot CLI

This project was **completely coded using Copilot CLI**. I used it for everything: from architecting the PTY multiplexer logic to writing a C-to-WASM ncurses shim. It was a meta-experience: using an AI to build a tool that makes using that AI more fun.

I really liked the interactive options. They provide a list of ways to proceed without needing to write them out manually.

In cases where I don't really care about how something is achieved, YOLO mode is particularly interesting to me. In this mode, Copilot doesn't check permissions and only asks about those interactive options. It's like a coworker you've lent your PC to and just trust. You just have to be careful not to tell them "please delete my PC".

I also enjoy having options of different LLMs, mostly Opus 4.6 blew my mind, it helped me solve difficult PTY terminal stuff. This is something I really appreciate in comparison to other tools.

### The Virtual Terminal Breakthrough

The hardest part was switching screens without losing state. I couldn't use standard ANSI "alternate screen" codes because Copilot CLI uses them itself. 

Guided by Copilot's suggestions, I implemented an in-process multiplexer using **@xterm/headless**. Instead of just piping output, I maintain virtual terminal buffers for both the AI and the games. When you switch screens, the wrapper serializes the inactive screen's buffer into ANSI sequences and replays it — making the transition pixel-perfect and preserving every bit of scrollback and history.

### The WASM & JS Game Engine

I wanted a wide variety of games without requiring users to have a C compiler. I compiled [nbsdgames](https://github.com/abakh/nbsdgames) to WebAssembly. This required writing `wasm/curses.h` — a shim that maps ncurses functions to raw ANSI escape codes. 

For simpler games, I implemented a **JS Game Engine**. The wrapper can launch any single-file Node.js script. You can even add your own by dropping a file into `~/.copilot-fun/games/`:

```javascript
// @game.id my-game
// @game.name My Custom Game
// @game.controls W/S to move

// Use process.env.LINES/COLS and raw ANSI to draw!
```

### Hooking into the AI's Brain

To show the status bar (e.g., **⟳ AI working**), I used [Copilot Hooks](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-hooks). Since there isn't much public info on hook timing, I asked Copilot CLI to help me write a debug logger. 

I discovered that `preToolUse` and `postToolUse` have specific patterns when permissions are required. By tracking these, I could drive the **Auto-Switch** feature, ensuring you never miss a prompt while you're busy setting a high score in 2048.

### What I Learned

1.  **ANSI nesting is hard**: You can't safely wrap a program that uses mouse tracking or alt-buffers (like Copilot does) without a full terminal emulator state machine.
2.  **PTY nuances**: PTYs send `\r` (13), but most C games expect `\n` (10). A single byte translation `13 → 10` in the input pipe fixed every game.
3.  **Focus Reporting Noise**: Copilot CLI enables focus reporting (`\x1b[?1004h`), which produces `ESC[I` and `ESC[O` events that clutter the input stream. I had to learn how to filter these to keep games responsive.
4.  **WASM is viable for TUI**: You can run complex C applications in the terminal via WASM with zero native dependencies if you provide a thin enough shim.

## Conclusion

Building **Copilot Fun Mode** showed me how powerful Copilot CLI is for exploring "uncharted territory" — like bridging 90s ncurses games with modern WebAssembly and Node.js PTYs. It transformed my "code-switch-wait" loop into a "code-play-vibe" loop. 

**Built with ❤️ using Copilot CLI.**

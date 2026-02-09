---
title: "Copilot Fun Mode — A TUI Wrapper Around GitHub Copilot CLI"
published: false
description: "How I built a terminal wrapper around GitHub Copilot CLI that lets you toggle to a fun screen while your AI codes. Built entirely with Copilot CLI."
tags: copilot, cli, tui, nodejs
cover_image:
---

## You Know That Feeling

Using TUI tools is great, but we often tend to switch back to the browser when we finish our prompt. Most of the time it's awesome to watch your virtual brain thinking and doing stuff — managing multiple agent sessions, approving tool calls. But sometimes, you just want to **VibeCode**.

For that I decided to create a wrapper around GitHub Copilot CLI, called **Copilot Fun Mode**.

And how did I build it? **Completely coded using Copilot CLI** with a combination of GPT-5.2 and Opus 4.6 models.

<!-- HERE VIDEO / ASCIINEMA SNIPPET -->

## The Idea: Games While Your AI Codes

We have multiple options for turn-based games: Tic-Tac-Toe, Go, Chess, Pexeso (let's see what you remember after giving your AGI the next prompt 😄).

The concept is simple: wrap Copilot CLI in a TUI that lets you **toggle** between the Copilot session and a fun screen using `Ctrl-G`.

## How Does It Work?

It's a wrapper — a wrapper around Copilot CLI + [Copilot Hooks](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-hooks), so you can execute commands after any action your agent takes.

### The Interface Problem

We can't simply embed into the Copilot TUI — there are no hooks for that and it's not open-source. But we **can** wrap the entire process using a pseudo-terminal (PTY).

The key challenge: we need to toggle between a "gaming TUI screen" and the "copilot screen" **within the same process**. I initially considered tmux, but that's not cross-platform (no Windows support).

### The Solution: node-pty + Alternate Screen Buffers

The approach is elegant in its simplicity:

1. **Spawn Copilot CLI** inside a pseudo-terminal using `node-pty`
2. **Pipe raw terminal data** between the real terminal and the PTY
3. **Intercept `Ctrl-G`** (byte `0x07`) to toggle screens
4. Use **ANSI alternate screen buffers** (`\x1b[?1049h` / `\x1b[?1049l`) to seamlessly save/restore the Copilot display

This means:
- ✅ Cross-platform (works on Windows, macOS, Linux via node-pty)
- ✅ Same process, no tmux dependency
- ✅ Full Copilot CLI experience preserved (colors, cursor, scrolling)
- ✅ Zero performance overhead
- ✅ Single `npm install` and you're running

### The Code

The entire wrapper is ~170 lines of vanilla Node.js with a single dependency (`node-pty`). Here's the core toggle mechanism:

```javascript
// Ctrl-G detected in raw stdin
function toggle() {
  if (activeScreen === 'copilot') {
    // Save copilot screen using alt screen buffer
    process.stdout.write('\x1b[?1049h');
    drawFunScreen();
  } else {
    // Restore copilot screen
    process.stdout.write('\x1b[?1049l');
    drawStatusBar();
  }
}
```

The alternate screen buffer is the same mechanism `vim`, `less`, and `htop` use — when you exit them, your previous terminal content is perfectly restored. We use this to preserve the Copilot session while showing the fun screen.

## Running It

```bash
# Clone and install
git clone <repo-url>
cd copilot-fun
npm install

# Link globally
npm link

# Run it!
copilot-cli

# Pass any copilot args through
copilot-cli --model claude-sonnet-4
```

Once running:
- **`Ctrl-G`** — Toggle between Copilot and Fun Mode
- **`Ctrl-C`** — Forward to Copilot (or quit from Fun screen)

## Alternatives Considered

Here's a breakdown of the approaches I evaluated before landing on the final solution:

### 1. **tmux / Screen** (Rejected)
- **Pros**: Battle-tested, multiple panes, session persistence
- **Cons**: Not cross-platform (no native Windows), external dependency, complex scripting for toggle UX
- **Verdict**: Great tool, wrong job. We need something in-process.

### 2. **blessed (Node.js)** (Rejected)
- **Pros**: Rich widget library, layout system, mouse support
- **Cons**: `blessed.terminal` requires deprecated `term.js`, project unmaintained since 2015, heavy dependency
- **Verdict**: Would have been ideal if the terminal widget worked. The library is essentially dead.

### 3. **neo-blessed / @pm2/blessed** (Considered)
- **Pros**: Maintained fork of blessed, same API
- **Cons**: Same terminal widget issue with `term.js`, still carries blessed's complexity
- **Verdict**: Same problems, different maintainer.

### 4. **blessed-xterm** (Considered)
- **Pros**: Proper xterm emulation in blessed, modern terminal handling
- **Cons**: Adds xterm.js + blessed as dependencies, complex rendering pipeline, overkill for a toggle wrapper
- **Verdict**: Over-engineered for our needs.

### 5. **Ink (React for CLI)** (Rejected)
- **Pros**: Modern, React paradigm, great for complex TUIs
- **Cons**: Cannot embed a raw PTY stream in a React component tree, fundamentally wrong abstraction level
- **Verdict**: Perfect for building CLI apps, wrong for wrapping an existing terminal program.

### 6. **terminal-kit** (Considered)
- **Pros**: Rich terminal manipulation, screen buffers, input handling
- **Cons**: Large dependency, its own abstraction layer fights with raw PTY passthrough
- **Verdict**: Viable but unnecessary overhead.

### 7. **Raw node-pty + ANSI escape codes** ✅ (Chosen)
- **Pros**: Minimal dependencies (just node-pty), cross-platform, full control, zero abstraction overhead, uses battle-tested ANSI alternate screen buffer mechanism
- **Cons**: Manual ANSI escape code handling, no widget system
- **Verdict**: **Winner.** Sometimes the simplest solution is the best. The alternate screen buffer trick gives us perfect screen save/restore for free.

### 8. **Electron / Tauri** (Not considered seriously)
- **Pros**: Full GUI, web technologies
- **Cons**: Nuclear warhead to kill a mosquito. We want a CLI wrapper, not a desktop app.

### 9. **Python (curses / Textual)** (Language alternative)
- **Pros**: curses is battle-tested, Textual is modern and gorgeous
- **Cons**: Different ecosystem from Copilot CLI (Node.js), Python PTY handling is less polished on Windows
- **Verdict**: Great option if you're in the Python world. Textual especially would give beautiful results.

### 10. **Go (tcell / bubbletea)** (Language alternative)
- **Pros**: Single binary distribution, excellent terminal handling, bubbletea is fantastic
- **Cons**: Go's PTY libraries are less mature on Windows, compile step needed
- **Verdict**: **Strong alternative.** If I were building this for distribution, I'd seriously consider bubbletea for the single-binary advantage.

## What's Next

The fun screen currently shows a "HELLO THERE" splash. The plan is to add:
- 🎮 Embedded TUI games (Tic-Tac-Toe, Chess via existing npm packages)
- 🔔 Copilot hook notifications (know when your agent needs approval without switching back)
- 📊 Agent activity dashboard
- 🎵 Maybe even some terminal ASCII art animations

## Conclusion

Sometimes the best tool is the simplest one. Instead of fighting with complex TUI frameworks, we just used raw ANSI escape codes and the alternate screen buffer — the same trick that `vim` and `less` have used for decades.

The entire wrapper is ~170 lines, has one dependency, and works cross-platform. **That's the power of understanding your terminal.**

Built with ❤️ using Copilot CLI — an AI building its own entertainment system. How meta is that?

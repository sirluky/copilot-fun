# Adding a JS Game to copilot-fun

To add a new JavaScript CLI game, create two files in this directory:

## 1. Game definition: `<game-id>.json`

```json
{
  "id": "pong",
  "name": "Pong",
  "desc": "Classic paddle ball game",
  "controls": "W/S or Arrow Up/Down to move paddle",
  "goal": "Score more points than your opponent.",
  "similar": "Pong (Atari)"
}
```

## 2. Game script: `<game-id>.js`

The script is spawned as a child process with `node games/<game-id>.js`.

Environment variables available:
- `LINES` — terminal rows (excluding status bar)
- `COLS` — terminal columns
- `TERM` — always `xterm-256color`

The game should:
- Read stdin in raw mode for keyboard input
- Write ANSI output to stdout
- Exit cleanly when the game ends (the wrapper catches the exit)
- **Not** handle SIGINT or q/ESC — the wrapper handles quit

### Minimal template

```js
#!/usr/bin/env node
const cols = parseInt(process.env.COLS || '80');
const rows = parseInt(process.env.LINES || '24');

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Clear screen and hide cursor
process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');

process.stdin.on('data', (key) => {
  // Game input handling here
});

function render() {
  // Game rendering here
}

function gameLoop() {
  render();
  setTimeout(gameLoop, 1000 / 30); // 30 FPS
}

gameLoop();
```

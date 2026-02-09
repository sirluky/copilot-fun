#!/usr/bin/env node

const pty = require('node-pty');
const { Terminal: VTerminal } = require('@xterm/headless');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const COPILOT_CMD = process.env.COPILOT_BIN || 'copilot';
const COPILOT_ARGS = process.argv.slice(2);
const WASM_DIR = path.join(__dirname, 'wasm');
const STATUS_FILE = path.join(process.cwd(), '.copilot-fun-status');
const HOOKS_DIR = path.join(process.cwd(), '.github', 'hooks');
const HOOKS_FILE = path.join(HOOKS_DIR, 'copilot-fun.json');

// ── Available games (turn-based only) ───────────────────────────────────────
const GAMES = [
  {
    id: 'fifteen', name: 'Fifteen Puzzle', desc: 'Slide numbered tiles into order',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to slide tile',
    goal: 'Arrange all tiles in numerical order with the empty space last.',
    similar: '15-Puzzle, Sliding Puzzle'
  },
  {
    id: 'mines', name: 'Mines', desc: 'Classic minesweeper',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to reveal, Space to flag',
    goal: 'Reveal all safe cells without hitting a mine.',
    similar: 'Minesweeper (Windows)'
  },
  {
    id: 'sudoku', name: 'Sudoku', desc: 'Number placement logic puzzle',
    controls: 'Arrow keys / WASD / HJKL to move, 1-9 to place, Space to clear',
    goal: 'Fill every row, column, and 3x3 box with digits 1-9.',
    similar: 'Sudoku'
  },
  {
    id: 'reversi', name: 'Reversi', desc: 'Strategic disc-flipping board game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to place disc',
    goal: 'Have the most discs of your color when the board is full.',
    similar: 'Othello'
  },
  {
    id: 'checkers', name: 'Checkers', desc: 'Classic diagonal capture game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to select/move piece',
    goal: "Capture all of your opponent's pieces or block them from moving.",
    similar: 'Draughts'
  },
  {
    id: 'sos', name: 'SOS', desc: 'Letter placement strategy game',
    controls: 'Arrow keys / WASD / HJKL to move, S or O to place letter',
    goal: 'Form as many S-O-S sequences as possible on the grid.',
    similar: 'Tic-Tac-Toe (extended)'
  },
  {
    id: 'battleship', name: 'Battleship', desc: 'Naval combat guessing game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to fire',
    goal: "Sink all of your opponent's ships before they sink yours.",
    similar: 'Battleship (board game)'
  },
  {
    id: 'memoblocks', name: 'Memoblocks', desc: 'Memory matching card game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to flip card',
    goal: 'Match all pairs of cards with the fewest flips possible.',
    similar: 'Concentration / Memory Game'
  },
  {
    id: 'rabbithole', name: 'Rabbit Hole', desc: 'Maze navigation puzzle',
    controls: 'Arrow keys / WASD / HJKL to move',
    goal: 'Guide the rabbit through the maze to collect all carrots.',
    similar: 'Maze Runner'
  },
  {
    id: 'revenge', name: 'Revenge', desc: 'Block-pushing puzzle game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to push',
    goal: 'Push blocks strategically to reach the goal.',
    similar: 'Sokoban'
  },
].filter(g => {
  try { fs.accessSync(path.join(WASM_DIR, `${g.id}.js`)); return true; }
  catch { return false; }
});

// ANSI helpers
const ESC = '\x1b';
const CSI = `${ESC}[`;
const CLEAR = `${CSI}2J${CSI}H`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const BOLD = `${CSI}1m`;
const RESET = `${CSI}0m`;
const CYAN = `${CSI}36m`;
const GREEN = `${CSI}32m`;
const YELLOW = `${CSI}33m`;
const DIM = `${CSI}2m`;
const BG_BLUE = `${CSI}44m`;
const BG_CYAN = `${CSI}46m`;
const BLACK = `${CSI}30m`;
const WHITE = `${CSI}37m`;

const FOCUS_RE = /\x1b\[[IO]/g;

// ── State ───────────────────────────────────────────────────────────────────
let activeScreen = 'copilot';
let ptyProcess = null;
let gameProcess = null;
let selectedGame = 0;
let copilotStatus = 'idle';
let statusPollInterval = null;
let statusBarTimer = null;
let vterm = null;
let gameVterm = null;

// ── Terminal size ───────────────────────────────────────────────────────────
function getCols() { return process.stdout.columns || 80; }
function getRows() { return process.stdout.rows || 24; }

// ── Virtual terminal (tracks copilot screen state like tmux) ────────────────
function createVTerm() {
  vterm = new VTerminal({
    rows: getRows() - 1,
    cols: getCols(),
    allowProposedApi: true,
  });
}

function createGameVTerm() {
  gameVterm = new VTerminal({
    rows: getRows() - 1,
    cols: getCols(),
    allowProposedApi: true,
  });
}

function serializeVTerm(term) {
  if (!term) term = vterm;
  if (!term) return CLEAR;
  const buf = term.buffer.active;
  const rows = term.rows;
  const cols = term.cols;
  let out = CLEAR + RESET;

  for (let y = 0; y < rows; y++) {
    const line = buf.getLine(y);
    if (!line) continue;
    out += `${CSI}${y + 1};1H`;
    let pFg = -99, pBg = -99, pB = false, pD = false, pU = false, pR = false;

    for (let x = 0; x < cols; x++) {
      const cell = line.getCell(x);
      if (!cell) { out += ' '; continue; }
      const ch = cell.getChars() || ' ';
      const fg = cell.getFgColor();
      const bg = cell.getBgColor();
      const b = !!(cell.isBold && cell.isBold());
      const d = !!(cell.isDim && cell.isDim());
      const u = !!(cell.isUnderline && cell.isUnderline());
      const r = !!(cell.isInverse && cell.isInverse());

      if (fg !== pFg || bg !== pBg || b !== pB || d !== pD || u !== pU || r !== pR) {
        const p = ['0'];
        if (b) p.push('1');
        if (d) p.push('2');
        if (u) p.push('4');
        if (r) p.push('7');
        if (fg >= 0 && fg < 8) p.push(String(30 + fg));
        else if (fg >= 8 && fg < 16) p.push(String(90 + fg - 8));
        else if (fg >= 16) p.push(`38;5;${fg}`);
        if (bg >= 0 && bg < 8) p.push(String(40 + bg));
        else if (bg >= 8 && bg < 16) p.push(String(100 + bg - 8));
        else if (bg >= 16) p.push(`48;5;${bg}`);
        out += `${CSI}${p.join(';')}m`;
        pFg = fg; pBg = bg; pB = b; pD = d; pU = u; pR = r;
      }
      out += ch;
    }
  }
  out += RESET;
  out += `${CSI}${buf.cursorY + 1};${buf.cursorX + 1}H`;
  out += SHOW_CURSOR;
  return out;
}

// ── Copilot hooks ───────────────────────────────────────────────────────────
function installHooks() {
  try {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    fs.writeFileSync(HOOKS_FILE, JSON.stringify({
      version: 1,
      hooks: {
        userPromptSubmitted: [{ type: 'command', bash: `echo "working" > "${STATUS_FILE}"`, timeoutSec: 5 }],
        preToolUse: [{ type: 'command', bash: `echo "working" > "${STATUS_FILE}"`, timeoutSec: 5 }],
        postToolUse: [{ type: 'command', bash: `echo "waiting" > "${STATUS_FILE}"`, timeoutSec: 5 }],
        sessionEnd: [{ type: 'command', bash: `echo "idle" > "${STATUS_FILE}"`, timeoutSec: 5 }],
      },
    }, null, 2));
    fs.writeFileSync(STATUS_FILE, 'idle');
  } catch (_) { }
}

function cleanupHooks() {
  try { fs.unlinkSync(STATUS_FILE); } catch (_) { }
  try { fs.unlinkSync(HOOKS_FILE); } catch (_) { }
  try { fs.rmdirSync(HOOKS_DIR); } catch (_) { }
  try { fs.rmdirSync(path.join(process.cwd(), '.github')); } catch (_) { }
}

function pollCopilotStatus() {
  statusPollInterval = setInterval(() => {
    try {
      const s = fs.readFileSync(STATUS_FILE, 'utf8').trim();
      if (s !== copilotStatus) { copilotStatus = s; scheduleStatusBarRedraw(); }
    } catch (_) { }
  }, 1000);
}

// ── Status bar ──────────────────────────────────────────────────────────────
function setScrollRegion() {
  process.stdout.write(`${CSI}1;${getRows() - 1}r`);
}

function resetScrollRegion() {
  process.stdout.write(`${CSI}r`);
}

function drawStatusBar() {
  const cols = getCols();
  const rows = getRows();
  let icon;
  switch (copilotStatus) {
    case 'working': icon = `${CSI}33m\u27F3 AI working${RESET}`; break;
    case 'waiting': icon = `${CSI}32m\u25CF Needs input${RESET}`; break;
    default: icon = `${DIM}\u25CB Idle${RESET}`; break;
  }
  let label, help;
  if (activeScreen === 'copilot') {
    label = ' COPILOT '; help = '  Ctrl-G: games';
  } else if (activeScreen === 'fun') {
    label = ' FUN MODE ';
    help = gameProcess ? '  Enter: resume  n: new  \u2191\u2193/WS: select  q: copilot' : '  Enter: play  \u2191\u2193/WS: select  q/Ctrl-G: back';
  } else {
    label = ' PLAYING '; help = '  Ctrl-G: pause  q: quit game';
  }
  const status = `  [${icon}${BG_BLUE}]`;
  const rawLen = label.length + help.length + copilotStatus.length + 10;
  const pad = Math.max(0, cols - rawLen);
  process.stdout.write(
    `${CSI}s${CSI}${rows};1H` +
    `${BG_BLUE}${WHITE}${BOLD}${label}${RESET}` +
    `${BG_BLUE}${DIM}${help}${RESET}` +
    `${BG_BLUE}${status}${BG_BLUE}` +
    `${BG_BLUE}${' '.repeat(pad)}${RESET}` +
    `${CSI}u`
  );
}

function scheduleStatusBarRedraw() {
  if (statusBarTimer) return;
  statusBarTimer = setTimeout(() => { statusBarTimer = null; drawStatusBar(); }, 80);
}

// ── Fun screen (game menu) ─────────────────────────────────────────────────
function drawFunScreen() {
  const cols = getCols();
  const rows = getRows();
  resetScrollRegion();
  process.stdout.write(CLEAR + HIDE_CURSOR);
  function center(text, rawLen) {
    return ' '.repeat(Math.max(0, Math.floor((cols - (rawLen || text.length)) / 2))) + text;
  }
  const header = [
    `${BOLD}${CYAN}  \u2554\u2550\u2557\u2554\u2550\u2557\u2554\u2550\u2557\u2566\u2566  \u2554\u2550\u2557\u2554\u2566\u2557  \u2554\u2550\u2557\u2566 \u2566\u2554\u2557\u2554${RESET}`,
    `${BOLD}${CYAN}  \u2551  \u2551 \u2551\u2560\u2550\u2563\u2551\u2551  \u2551 \u2551 \u2551   \u2560\u2563 \u2551 \u2551\u2551\u2551\u2551${RESET}`,
    `${BOLD}${CYAN}  \u255A\u2550\u255D\u255A\u2550\u255D\u2569  \u2569\u2569\u2550\u255D\u255A\u2550\u255D \u2569   \u255A  \u255A\u2550\u255D\u255D\u255A\u255D${RESET}`,
  ];
  let row = 1;
  for (const l of header) { process.stdout.write(`${CSI}${row};1H${l}`); row++; }
  row++;
  const pauseHint = gameProcess ? `  ${DIM}(game paused)${RESET}` : '';
  process.stdout.write(`${CSI}${row};1H${center(`${BOLD}${YELLOW}\uD83C\uDFAE  SELECT A GAME  \uD83C\uDFAE${RESET}${pauseHint}`, 21)}`);
  row += 2;
  const game = GAMES[selectedGame];
  const maxVis = Math.min(GAMES.length, rows - row - 9);
  let start = Math.max(0, selectedGame - Math.floor(maxVis / 2));
  start = Math.min(start, Math.max(0, GAMES.length - maxVis));
  for (let i = 0; i < maxVis; i++) {
    const idx = start + i;
    if (idx >= GAMES.length) break;
    const g = GAMES[idx];
    const sel = idx === selectedGame;
    const pfx = sel ? `${BG_CYAN}${BLACK}${BOLD} \u25B8 ` : '   ';
    const nm = g.name.padEnd(16);
    const line = sel ? `${pfx}${nm} ${g.desc} ${RESET}` : `${pfx}${nm}${DIM}${g.desc}${RESET}`;
    process.stdout.write(`${CSI}${row + i};1H${center(line, 20 + g.desc.length)}`);
  }
  const ir = row + maxVis + 1;
  process.stdout.write(`${CSI}${ir};1H${center(`${DIM}${'\u2500'.repeat(50)}${RESET}`, 50)}`);
  process.stdout.write(`${CSI}${ir + 1};1H${center(`${BOLD}${GREEN}${game.name}${RESET}  ${DIM}(like ${game.similar})${RESET}`, game.name.length + game.similar.length + 9)}`);
  process.stdout.write(`${CSI}${ir + 2};1H${center(`${CYAN}Controls:${RESET} ${game.controls}`, 10 + game.controls.length)}`);
  process.stdout.write(`${CSI}${ir + 3};1H${center(`${YELLOW}Goal:${RESET} ${game.goal}`, 6 + game.goal.length)}`);
  drawStatusBar();
}

// ── Game management ─────────────────────────────────────────────────────────
function launchGame(gameId) {
  activeScreen = 'game';
  const gameFile = path.join(WASM_DIR, `${gameId}.js`);
  const cols = getCols();
  const rows = getRows() - 1;
  resetScrollRegion();
  process.stdout.write(CLEAR);
  createGameVTerm();
  const gameEnv = { ...process.env, TERM: 'xterm-256color', LINES: String(rows), COLS: String(cols) };
  if (gameId === 'sudoku') gameEnv.SUDOKU_FASTGEN = '1';
  const supportsN = ['fifteen', 'mines', 'reversi', 'checkers', 'sos', 'revenge'];
  const gameArgs = gameId === 'sudoku' ? [gameFile, '-f'] : supportsN.includes(gameId) ? [gameFile, '-n'] : [gameFile];
  gameProcess = pty.spawn('node', gameArgs, {
    name: 'xterm-256color', cols, rows, cwd: process.cwd(),
    env: gameEnv,
  });
  gameProcess.onData((data) => {
    if (gameVterm) gameVterm.write(data);
    if (activeScreen === 'game') process.stdout.write(data);
  });
  gameProcess.onExit(() => { gameProcess = null; gameVterm = null; if (activeScreen === 'game') { activeScreen = 'fun'; drawFunScreen(); } });
  drawStatusBar();
}

function pauseGame() { activeScreen = 'fun'; drawFunScreen(); }

function resumeGame() {
  if (!gameProcess) return false;
  activeScreen = 'game';
  resetScrollRegion();
  process.stdout.write(serializeVTerm(gameVterm));
  drawStatusBar();
  return true;
}

function destroyGame() {
  if (gameProcess) { try { gameProcess.destroy(); } catch (_) { } gameProcess = null; }
  gameVterm = null;
}

// ── Copilot PTY ─────────────────────────────────────────────────────────────
function startCopilot() {
  const cols = getCols();
  const rows = getRows() - 1;
  createVTerm();
  setScrollRegion();
  process.stdout.write(`${CSI}?1004l`);
  ptyProcess = pty.spawn(COPILOT_CMD, COPILOT_ARGS, {
    name: 'xterm-256color', cols, rows, cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });
  ptyProcess.onData((data) => {
    if (vterm) vterm.write(data);
    if (activeScreen === 'copilot') {
      const cleaned = data.replace(FOCUS_RE, '');
      if (cleaned) process.stdout.write(cleaned);
      scheduleStatusBarRedraw();
    }
  });
  ptyProcess.onExit(({ exitCode }) => { cleanup(); process.exit(exitCode || 0); });
}

// ── Screen switching ────────────────────────────────────────────────────────
function switchToFun() { activeScreen = 'fun'; drawFunScreen(); }

function switchToCopilot() {
  activeScreen = 'copilot';
  resetScrollRegion();
  process.stdout.write(serializeVTerm(vterm));
  setScrollRegion();
  drawStatusBar();
}

function toggle() {
  if (activeScreen === 'copilot') switchToFun();
  else if (activeScreen === 'fun') switchToCopilot();
  else if (activeScreen === 'game') pauseGame();
}

// ── Input handling ──────────────────────────────────────────────────────────
function setupInput() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding(null);

  process.stdin.on('data', (data) => {
    const bytes = Buffer.from(data);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x07) { toggle(); return; }
    }
    if (activeScreen === 'copilot' && ptyProcess) { ptyProcess.write(data.toString()); return; }
    if (activeScreen === 'game' && gameProcess) {
      if (bytes.length === 1 && bytes[0] === 0x71) { destroyGame(); activeScreen = 'fun'; drawFunScreen(); return; }
      gameProcess.write(data.toString());
      return;
    }
    if (activeScreen === 'fun') {
      if (bytes.length === 3 && bytes[0] === 0x1b && bytes[1] === 0x5b) {
        if (bytes[2] === 0x41) { selectedGame = Math.max(0, selectedGame - 1); drawFunScreen(); return; }
        if (bytes[2] === 0x42) { selectedGame = Math.min(GAMES.length - 1, selectedGame + 1); drawFunScreen(); return; }
      }
      if (bytes.length === 1) {
        const ch = bytes[0];
        if (ch === 0x77 || ch === 0x6b) { selectedGame = Math.max(0, selectedGame - 1); drawFunScreen(); return; }
        if (ch === 0x73 || ch === 0x6a) { selectedGame = Math.min(GAMES.length - 1, selectedGame + 1); drawFunScreen(); return; }
        if (ch === 0x0d || ch === 0x0a) { if (gameProcess) resumeGame(); else launchGame(GAMES[selectedGame].id); return; }
        if (ch === 0x6e) { destroyGame(); launchGame(GAMES[selectedGame].id); return; }
        if (ch === 0x71) { destroyGame(); switchToCopilot(); return; }
      }
    }
  });
}

// ── Resize ──────────────────────────────────────────────────────────────────
process.stdout.on('resize', () => {
  const cols = getCols();
  const rows = getRows() - 1;
  if (ptyProcess) ptyProcess.resize(cols, rows);
  if (vterm) vterm.resize(cols, rows);
  if (gameProcess) gameProcess.resize(cols, rows);
  if (gameVterm) gameVterm.resize(cols, rows);
  if (activeScreen === 'copilot') { setScrollRegion(); drawStatusBar(); }
  else if (activeScreen === 'fun') drawFunScreen();
  else drawStatusBar();
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
function cleanup() {
  resetScrollRegion();
  process.stdout.write(SHOW_CURSOR + RESET);
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch (_) { } }
  if (statusPollInterval) clearInterval(statusPollInterval);
  if (statusBarTimer) clearTimeout(statusBarTimer);
  destroyGame();
  cleanupHooks();
}

process.on('SIGINT', () => {
  if (activeScreen === 'copilot' && ptyProcess) ptyProcess.write('\x03');
  else if (activeScreen === 'game' && gameProcess) gameProcess.write('\x03');
});
process.on('exit', cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// ── Main ────────────────────────────────────────────────────────────────────
installHooks();
pollCopilotStatus();
process.stdout.write(CLEAR);
drawStatusBar();
startCopilot();
setupInput();

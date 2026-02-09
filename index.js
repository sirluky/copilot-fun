#!/usr/bin/env node

const pty = require('node-pty');
const os = require('os');

// ── Config ──────────────────────────────────────────────────────────────────
const COPILOT_CMD = process.env.COPILOT_BIN || 'copilot';
const COPILOT_ARGS = process.argv.slice(2);

// ANSI helpers
const ESC = '\x1b';
const CSI = `${ESC}[`;
const SAVE_SCREEN = `${CSI}?1049h`;
const RESTORE_SCREEN = `${CSI}?1049l`;
const CLEAR = `${CSI}2J${CSI}H`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const BOLD = `${CSI}1m`;
const RESET = `${CSI}0m`;
const CYAN = `${CSI}36m`;
const GREEN = `${CSI}32m`;
const YELLOW = `${CSI}33m`;
const MAGENTA = `${CSI}35m`;
const DIM = `${CSI}2m`;
const BG_BLUE = `${CSI}44m`;
const WHITE = `${CSI}37m`;

// ── State ───────────────────────────────────────────────────────────────────
let activeScreen = 'copilot'; // 'copilot' | 'fun'
let ptyProcess = null;
let savedCopilotScreen = ''; // buffer for copilot output
const copilotBuffer = [];

// ── Terminal size ───────────────────────────────────────────────────────────
function getCols() { return process.stdout.columns || 80; }
function getRows() { return process.stdout.rows || 24; }

// ── Status bar ──────────────────────────────────────────────────────────────
function drawStatusBar() {
  const cols = getCols();
  const rows = getRows();
  const label = activeScreen === 'copilot' ? ' COPILOT ' : ' FUN MODE ';
  const help = '  Ctrl-G: toggle  Ctrl-C: quit';
  const content = label + help;
  const padding = Math.max(0, cols - content.length);

  // Move to last row, draw status bar
  process.stdout.write(
    `${CSI}${rows};1H` +   // move to last row
    `${BG_BLUE}${WHITE}${BOLD}${label}${RESET}` +
    `${BG_BLUE}${DIM}${help}${RESET}` +
    `${BG_BLUE}${' '.repeat(padding)}${RESET}`
  );
}

// ── Fun screen content ─────────────────────────────────────────────────────
function drawFunScreen() {
  const cols = getCols();
  const rows = getRows();

  process.stdout.write(CLEAR + HIDE_CURSOR);

  function centerLine(text, rawLen) {
    const pad = Math.max(0, Math.floor((cols - (rawLen || text.length)) / 2));
    return ' '.repeat(pad) + text;
  }

  const lines = [
    '',
    `${BOLD}${CYAN}   ██████╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗${RESET}`,
    `${BOLD}${CYAN}  ██╔════╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝${RESET}`,
    `${BOLD}${CYAN}  ██║     ██║   ██║██████╔╝██║██║     ██║   ██║   ██║   ${RESET}`,
    `${BOLD}${CYAN}  ██║     ██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║   ${RESET}`,
    `${BOLD}${CYAN}  ╚██████╗╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║   ${RESET}`,
    `${BOLD}${CYAN}   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   ${RESET}`,
    '',
    `${BOLD}${GREEN}  ███████╗██╗   ██╗███╗   ██╗    ███╗   ███╗ ██████╗ ██████╗ ███████╗${RESET}`,
    `${BOLD}${GREEN}  ██╔════╝██║   ██║████╗  ██║    ████╗ ████║██╔═══██╗██╔══██╗██╔════╝${RESET}`,
    `${BOLD}${GREEN}  █████╗  ██║   ██║██╔██╗ ██║    ██╔████╔██║██║   ██║██║  ██║█████╗  ${RESET}`,
    `${BOLD}${GREEN}  ██╔══╝  ██║   ██║██║╚██╗██║    ██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ${RESET}`,
    `${BOLD}${GREEN}  ██║     ╚██████╔╝██║ ╚████║    ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗${RESET}`,
    `${BOLD}${GREEN}  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝    ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝${RESET}`,
    '',
    '',
    centerLine(`${BOLD}${YELLOW}HELLO THERE!${RESET}`, 12),
    '',
    centerLine(`Welcome to Copilot Fun Mode 🎮`, 30),
    centerLine(`${DIM}Your AI is coding while you chill.${RESET}`, 34),
    '',
    centerLine(`${DIM}─────────────────────────────────────${RESET}`, 37),
    '',
    centerLine(`${BOLD}Controls:${RESET}`, 9),
    centerLine(`${CYAN}Ctrl-G${RESET}  Toggle back to Copilot`, 30),
    centerLine(`${CYAN}Ctrl-C${RESET}  Quit`, 13),
    '',
    centerLine(`${DIM}─────────────────────────────────────${RESET}`, 37),
    '',
    centerLine(`${MAGENTA}Built with ❤️  using Copilot CLI${RESET}`, 31),
    centerLine(`${MAGENTA}Completely coded by GPT-5.2 / Opus 4.6${RESET}`, 39),
  ];

  // Vertically center
  const startRow = Math.max(0, Math.floor((rows - 1 - lines.length) / 2));
  for (let i = 0; i < lines.length; i++) {
    process.stdout.write(`${CSI}${startRow + i + 1};1H${lines[i]}`);
  }

  drawStatusBar();
}

// ── PTY management ──────────────────────────────────────────────────────────
function startCopilot() {
  const cols = getCols();
  const rows = getRows() - 1; // reserve 1 row for status bar

  ptyProcess = pty.spawn(COPILOT_CMD, COPILOT_ARGS, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  ptyProcess.onData((data) => {
    if (activeScreen === 'copilot') {
      process.stdout.write(data);
      // Redraw status bar after copilot output (it may have scrolled)
      drawStatusBar();
    }
    // Always buffer so we can restore
    copilotBuffer.push(data);
    if (copilotBuffer.length > 5000) copilotBuffer.shift();
  });

  ptyProcess.onExit(({ exitCode }) => {
    cleanup();
    process.exit(exitCode || 0);
  });
}

// ── Screen switching ────────────────────────────────────────────────────────
function switchToFun() {
  activeScreen = 'fun';
  // Save copilot screen using alt screen buffer
  process.stdout.write(SAVE_SCREEN);
  drawFunScreen();
}

function switchToCopilot() {
  activeScreen = 'copilot';
  // Restore copilot screen
  process.stdout.write(RESTORE_SCREEN);
  process.stdout.write(SHOW_CURSOR);
  drawStatusBar();
}

function toggle() {
  if (activeScreen === 'copilot') {
    switchToFun();
  } else {
    switchToCopilot();
  }
}

// ── Input handling ──────────────────────────────────────────────────────────
function setupInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding(null);

  process.stdin.on('data', (data) => {
    const bytes = Buffer.from(data);

    for (let i = 0; i < bytes.length; i++) {
      // Ctrl-G = 0x07 (BEL)
      if (bytes[i] === 0x07) {
        toggle();
        return; // consume entire chunk on toggle
      }
    }

    if (activeScreen === 'copilot' && ptyProcess) {
      ptyProcess.write(data.toString());
    }
    // In fun screen, swallow all input except Ctrl-G and Ctrl-C
  });
}

// ── Resize handling ─────────────────────────────────────────────────────────
process.stdout.on('resize', () => {
  if (ptyProcess) {
    ptyProcess.resize(getCols(), getRows() - 1);
  }
  if (activeScreen === 'fun') {
    drawFunScreen();
  } else {
    drawStatusBar();
  }
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
function cleanup() {
  process.stdout.write(SHOW_CURSOR);
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch (_) {}
  }
}

process.on('SIGINT', () => {
  if (ptyProcess) {
    ptyProcess.write('\x03'); // forward Ctrl-C to copilot
  }
});

process.on('exit', cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  // Initial clear and status
  process.stdout.write(CLEAR);
  drawStatusBar();

  startCopilot();
  setupInput();
}

main();

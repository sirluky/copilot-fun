#!/usr/bin/env node

// @ts-check

const pty = require('node-pty');
const { Terminal: VTerminal } = require('@xterm/headless');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * @typedef {'copilot' | 'fun' | 'game'} Screen
 * @typedef {'idle' | 'working' | 'waiting'} CopilotStatus
 * @typedef {{ id: string, name: string, desc: string, controls: string, goal: string, similar: string, type: 'wasm' | 'js', path?: string }} GameDef
 */

// ── Config ──────────────────────────────────────────────────────────────────
/** @type {boolean} */
const YOLO_FLAG = process.argv.includes('--yolo');
/** @type {string} */
const COPILOT_CMD = process.env.COPILOT_BIN || 'copilot';
/** @type {string[]} */
const COPILOT_ARGS = process.argv.slice(2).filter(a => a !== '--yolo');
/** @type {string} */
const WASM_DIR = path.join(__dirname, 'wasm');
/** @type {string} */
const GAMES_DIR = path.join(__dirname, 'games');
/** @type {string} */
const COPILOT_FUN_HOME = path.join(os.homedir(), '.copilot-fun');
/** @type {string} */
const CUSTOM_GAMES_DIR = path.join(COPILOT_FUN_HOME, 'games');
/** @type {string} */
const STATUS_FILE = path.join(COPILOT_FUN_HOME, 'status');
/** @type {string} */
const HOOKS_DIR = path.join(process.cwd(), '.github', 'hooks');
/** @type {string} */
const HOOKS_FILE = path.join(HOOKS_DIR, 'copilot-fun.json');
/** @type {string} */
const HOOKS_DEBUG_FILE = path.join(COPILOT_FUN_HOME, 'hooks-debug.log');
/** @type {string} */
const COPILOT_PROMPTS_DIR = path.join(os.homedir(), '.copilot', 'prompts');

// ── Available games (turn-based only) ───────────────────────────────────────
/** @type {GameDef[]} */
const GAMES = [
  {
    id: 'fifteen', name: 'Fifteen Puzzle', desc: 'Slide numbered tiles into order',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to slide tile',
    goal: 'Arrange all tiles in numerical order with the empty space last.',
    similar: '15-Puzzle, Sliding Puzzle', type: 'wasm'
  },
  {
    id: 'mines', name: 'Mines', desc: 'Classic minesweeper',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to reveal, Space to flag',
    goal: 'Reveal all safe cells without hitting a mine.',
    similar: 'Minesweeper (Windows)', type: 'wasm'
  },
  {
    id: 'sudoku', name: 'Sudoku', desc: 'Number placement logic puzzle',
    controls: 'Arrow keys / WASD / HJKL to move, 1-9 to place, Space to clear',
    goal: 'Fill every row, column, and 3x3 box with digits 1-9.',
    similar: 'Sudoku', type: 'wasm'
  },
  {
    id: 'reversi', name: 'Reversi', desc: 'Strategic disc-flipping board game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to place disc',
    goal: 'Have the most discs of your color when the board is full.',
    similar: 'Othello', type: 'wasm'
  },
  {
    id: 'checkers', name: 'Checkers', desc: 'Classic diagonal capture game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to select/move piece',
    goal: "Capture all of your opponent's pieces or block them from moving.",
    similar: 'Draughts', type: 'wasm'
  },
  {
    id: 'sos', name: 'SOS', desc: 'Letter placement strategy game',
    controls: 'Arrow keys / WASD / HJKL to move, S or O to place letter',
    goal: 'Form as many S-O-S sequences as possible on the grid.',
    similar: 'Tic-Tac-Toe (extended)', type: 'wasm'
  },
  {
    id: 'battleship', name: 'Battleship', desc: 'Naval combat guessing game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to fire',
    goal: "Sink all of your opponent's ships before they sink yours.",
    similar: 'Battleship (board game)', type: 'wasm'
  },
  {
    id: 'memoblocks', name: 'Memoblocks', desc: 'Memory matching card game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to flip card',
    goal: 'Match all pairs of cards with the fewest flips possible.',
    similar: 'Concentration / Memory Game', type: 'wasm'
  },
  {
    id: 'rabbithole', name: 'Rabbit Hole', desc: 'Maze navigation puzzle',
    controls: 'Arrow keys / WASD / HJKL to move',
    goal: 'Guide the rabbit through the maze to collect all carrots.',
    similar: 'Maze Runner', type: 'wasm'
  },
  {
    id: 'revenge', name: 'Revenge', desc: 'Block-pushing puzzle game',
    controls: 'Arrow keys / WASD / HJKL to move, Enter to push',
    goal: 'Push blocks strategically to reach the goal.',
    similar: 'Sokoban', type: 'wasm'
  },
].filter(g => {
  try { fs.accessSync(path.join(WASM_DIR, `${g.id}.js`)); return true; }
  catch { return false; }
});

// ── Load JS games from games/ directory ─────────────────────────────────────
try {
  if (fs.existsSync(GAMES_DIR)) {
    const jsGameFiles = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.json'));
    for (const file of jsGameFiles) {
      try {
        const def = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, file), 'utf8'));
        const scriptFile = path.join(GAMES_DIR, `${def.id}.js`);
        if (fs.existsSync(scriptFile) && def.id && def.name) {
          GAMES.push({ ...def, type: 'js' });
        }
      } catch (_) { }
    }
  }
} catch (_) { }

// ── Load custom JS games from .copilot-fun/ directory ───────────────────────
try {
  if (fs.existsSync(CUSTOM_GAMES_DIR)) {
    const customFiles = fs.readdirSync(CUSTOM_GAMES_DIR).filter(f => f.endsWith('.js'));
    for (const file of customFiles) {
      try {
        const filePath = path.join(CUSTOM_GAMES_DIR, file);
        const src = fs.readFileSync(filePath, 'utf8');
        const meta = {};
        const metaRe = /^\/\/\s*@game\.(\w+)\s+(.+)$/gm;
        let m;
        while ((m = metaRe.exec(src)) !== null) meta[m[1]] = m[2].trim();
        if (meta.id && meta.name) {
          GAMES.push({
            id: meta.id,
            name: meta.name,
            desc: meta.desc || '',
            controls: meta.controls || 'Arrow keys / WASD to move',
            goal: meta.goal || '',
            similar: meta.similar || '',
            type: 'js',
            path: filePath,
          });
        }
      } catch (_) { }
    }
  }
} catch (_) { }

// ── ANSI helpers ────────────────────────────────────────────────────────────
/** @type {string} */
const ESC = '\x1b';
/** @type {string} */
const CSI = `${ESC}[`;
/** @type {string} */
const CLEAR = `${CSI}2J${CSI}H`;
/** @type {string} */
const HIDE_CURSOR = `${CSI}?25l`;
/** @type {string} */
const SHOW_CURSOR = `${CSI}?25h`;
/** @type {string} */
const BOLD = `${CSI}1m`;
/** @type {string} */
const RESET = `${CSI}0m`;
/** @type {string} */
const CYAN = `${CSI}36m`;
/** @type {string} */
const GREEN = `${CSI}32m`;
/** @type {string} */
const YELLOW = `${CSI}33m`;
/** @type {string} */
const DIM = `${CSI}2m`;
/** @type {string} */
const BG_BLUE = `${CSI}44m`;
/** @type {string} */
const BG_CYAN = `${CSI}46m`;
/** @type {string} */
const BLACK = `${CSI}30m`;
/** @type {string} */
const WHITE = `${CSI}37m`;
/** @type {string} */
const BG_BRIGHT_YELLOW = `${CSI}103m`;

// ── OSC progress state (terminal window progress indicator) ─────────────────
/** @type {string} */
const OSC_PROGRESS_BUSY = `\x1b]9;4;3\x07`;
/** @type {string} */
const OSC_PROGRESS_DONE = `\x1b]9;4;0\x07`;

/** @type {RegExp} */
const FOCUS_RE = /\x1b\[[IO]/g;

// ── State ───────────────────────────────────────────────────────────────────
/** @type {Screen} */
let activeScreen = 'copilot';
/** @type {import('node-pty').IPty | null} */
let ptyProcess = null;
/** @type {import('node-pty').IPty | null} */
let gameProcess = null;
/** @type {number} */
let selectedGame = 0;
/** @type {CopilotStatus} */
let copilotStatus = 'idle';
/** @type {ReturnType<typeof setInterval> | null} */
let statusPollInterval = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let statusBarTimer = null;
/** @type {InstanceType<typeof VTerminal> | null} */
let vterm = null;
/** @type {InstanceType<typeof VTerminal> | null} */
let gameVterm = null;
/** @type {string | null} */
let lastGameId = null;
/** @type {number} */
let ctrlCTime = 0;
/** @type {boolean} */
let autoSwitchMode = false;
/** @type {string} */
let lastHookName = '';
/** @type {number} */
let lastHookTime = 0;
/** @type {number} */
let pendingToolOps = 0;
/** @type {number} */
let lastHookLogPosition = 0;

// ── Terminal size ───────────────────────────────────────────────────────────
/** @returns {number} */
function getCols() { return process.stdout.columns || 80; }
/** @returns {number} */
function getRows() { return process.stdout.rows || 24; }

// ── Virtual terminal (tracks copilot screen state like tmux) ────────────────
/** @returns {void} */
function createVTerm() {
  vterm = new VTerminal({
    rows: getRows() - 1,
    cols: getCols(),
    allowProposedApi: true,
  });
}

/** @returns {void} */
function createGameVTerm() {
  gameVterm = new VTerminal({
    rows: getRows() - 1,
    cols: getCols(),
    allowProposedApi: true,
  });
}

/**
 * Serialize a virtual terminal's screen buffer to ANSI escape sequences.
 * @param {InstanceType<typeof VTerminal> | null} [term] - Terminal to serialize (defaults to copilot vterm)
 * @returns {string} ANSI escape sequence string that reproduces the screen
 */
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
    /** @type {number} */ let pFg = -99;
    /** @type {number} */ let pBg = -99;
    /** @type {boolean} */ let pB = false;
    /** @type {boolean} */ let pD = false;
    /** @type {boolean} */ let pU = false;
    /** @type {boolean} */ let pR = false;

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
        /** @type {string[]} */
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

// ── Setup (home dirs, hooks, prompts) ────────────────────────────────────────

/** @returns {void} */
function setupHomeDirs() {
  try {
    fs.mkdirSync(COPILOT_FUN_HOME, { recursive: true });
    fs.mkdirSync(CUSTOM_GAMES_DIR, { recursive: true });
    fs.mkdirSync(COPILOT_PROMPTS_DIR, { recursive: true });
  } catch (_) { }
}

/** @returns {void} */
function installPrompts() {
  const addGamePrompt = path.join(COPILOT_PROMPTS_DIR, 'copilot-fun-add-game.md');
  const askGamePrompt = path.join(COPILOT_PROMPTS_DIR, 'copilot-fun-ask-about-game.md');
  const addGameSrc = path.join(__dirname, '.github', 'agents', 'copilot-fun-add-game.md');
  const askGameSrc = path.join(__dirname, '.github', 'agents', 'copilot-fun-ask-about-game.md');
  try { if (fs.existsSync(addGameSrc)) fs.copyFileSync(addGameSrc, addGamePrompt); } catch (_) { }
  try { if (fs.existsSync(askGameSrc)) fs.copyFileSync(askGameSrc, askGamePrompt); } catch (_) { }
}

// ── Copilot hooks (installed in CWD/.github/hooks/ per Copilot CLI docs) ────
/** @returns {void} */
function installHooks() {
  try {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    try { fs.writeFileSync(HOOKS_DEBUG_FILE, ''); } catch (_) { }
    const statusPath = STATUS_FILE.replace(/\\/g, '/');
    const debugPath = HOOKS_DEBUG_FILE.replace(/\\/g, '/');
    const logCmd = (hookName) => {
      const bashCmd = `echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ${hookName}" >> "${debugPath}"`;
      const psCmd = `Add-Content -Path "${debugPath}" -Value "[$(Get-Date -u -f 'yyyy-MM-ddTHH:mm:ssZ')] ${hookName}"`;
      return { type: 'command', bash: bashCmd, powershell: psCmd, timeoutSec: 5 };
    };
    fs.writeFileSync(HOOKS_FILE, JSON.stringify({
      version: 1,
      hooks: {
        sessionStart: [logCmd('sessionStart')],
        sessionEnd: [logCmd('sessionEnd'), { type: 'command', bash: `echo "idle" > "${statusPath}"`, powershell: `Set-Content -Path "${statusPath}" -Value "idle"`, timeoutSec: 5 }],
        userPromptSubmitted: [logCmd('userPromptSubmitted'), { type: 'command', bash: `echo "working" > "${statusPath}"`, powershell: `Set-Content -Path "${statusPath}" -Value "working"`, timeoutSec: 5 }],
        preToolUse: [logCmd('preToolUse')],
        postToolUse: [logCmd('postToolUse')],
        errorOccurred: [logCmd('errorOccurred')],
      },
    }, null, 2));
    fs.writeFileSync(STATUS_FILE, 'idle');
  } catch (_) { }
}

/** @returns {void} */
function cleanupHooks() {
  try { fs.writeFileSync(STATUS_FILE, 'idle'); } catch (_) { }
  try { fs.unlinkSync(HOOKS_FILE); } catch (_) { }
  // Only remove dirs if empty
  try { fs.rmdirSync(HOOKS_DIR); } catch (_) { }
}

/** @returns {void} */
function pollCopilotStatus() {
  statusPollInterval = setInterval(() => {
    let changed = false;
    try {
      if (fs.existsSync(HOOKS_DEBUG_FILE)) {
        const stats = fs.statSync(HOOKS_DEBUG_FILE);
        if (stats.size > lastHookLogPosition) {
          const fd = fs.openSync(HOOKS_DEBUG_FILE, 'r');
          const length = stats.size - lastHookLogPosition;
          const buffer = Buffer.alloc(length);
          fs.readSync(fd, buffer, 0, length, lastHookLogPosition);
          fs.closeSync(fd);

          lastHookLogPosition = stats.size;
          const newContent = buffer.toString('utf8');
          const newLines = newContent.split('\n').filter(l => l.trim());

          for (const line of newLines) {
            const match = line.match(/\] (\w+)$/);
            if (match) {
              const hookName = match[1];
              lastHookName = hookName;
              if (hookName === 'preToolUse') {
                pendingToolOps++;
                changed = true;
              } else if (hookName === 'postToolUse') {
                pendingToolOps = Math.max(0, pendingToolOps - 1);
                changed = true;
              } else if (hookName === 'userPromptSubmitted') {
                pendingToolOps = 0;
                changed = true;
              } else if (hookName === 'sessionEnd' || hookName === 'errorOccurred') {
                pendingToolOps = 0;
                changed = true;
              }
            }
          }
          lastHookTime = stats.mtime.getTime();
        } else if (stats.size < lastHookLogPosition) {
          lastHookLogPosition = stats.size;
          pendingToolOps = 0;
          changed = true;
        }
      }
    } catch (_) { }

    try {
      const s = /** @type {CopilotStatus} */ (fs.readFileSync(STATUS_FILE, 'utf8').trim());
      let newStatus = s;

      // If a session is active (working), check if we are waiting for tool confirmation
      if (s === 'working' && pendingToolOps > 0) {
        // preToolUse means Copilot is waiting for user to allow/deny tool
        newStatus = 'waiting';
      }

      if (newStatus !== copilotStatus) {
        copilotStatus = newStatus;
        process.stdout.write(copilotStatus === 'working' ? OSC_PROGRESS_BUSY : OSC_PROGRESS_DONE);
        changed = true;
      }
    } catch (_) { }

    if (changed) {
      if (autoSwitchMode) handleAutoSwitch();
      scheduleStatusBarRedraw();
    }
  }, 200);
}

/**
 * Auto-switch between copilot and game based on copilot status.
 * When copilot is working autonomously -> toggle to game.
 * When copilot needs input (waiting) or is done (idle) -> toggle to copilot.
 * @returns {void}
 */
function handleAutoSwitch() {
  if (copilotStatus === 'working') {
    // AI is working autonomously - switch TO game/menu
    if (activeScreen === 'copilot') toggle();
  } else {
    // AI needs input (waiting) or is idle - switch TO copilot
    if (activeScreen === 'game' || activeScreen === 'fun') {
      activeScreen = 'copilot';
      recalculateAndRedraw();
    }
  }
}

// ── Status bar ──────────────────────────────────────────────────────────────
/** @returns {void} */
function setScrollRegion() {
  process.stdout.write(`${CSI}1;${getRows() - 1}r`);
}

/** @returns {void} */
function resetScrollRegion() {
  process.stdout.write(`${CSI}r`);
}

/** @returns {string} */
function getStatusBarSequence() {
  const cols = getCols();
  const rows = getRows();
  /** @type {string} */
  let icon;
  switch (copilotStatus) {
    case 'working': icon = `${CSI}33m\u27F3 AI working${RESET}`; break;
    case 'waiting': icon = `${CSI}32m\u25CF Needs input${RESET}`; break;
    default: icon = `${DIM}\u25CB Idle${RESET}`; break;
  }
  /** @type {string} */
  let label;
  /** @type {string} */
  let help;
  if (activeScreen === 'copilot') {
    label = ' COPILOT '; help = '  Ctrl-G: games  Ctrl-S: auto';
  } else if (activeScreen === 'fun') {
    label = ' FUN MODE ';
    help = gameProcess ? '  Enter: resume  n: new  \u2191\u2193/WS: select  q: copilot' : '  Enter: play  \u2191\u2193/WS: select  q/Ctrl-G: back';
  } else {
    label = ' PLAYING '; help = '  q/ESC: quit game  Ctrl-G: copilot';
  }
  const autoTag = autoSwitchMode ? `  ${CSI}35m\u2B82 AUTO${RESET}${BG_BLUE}` : '';
  const toolTag = pendingToolOps > 0 ? `  ${CSI}33m[x${pendingToolOps}]${RESET}${BG_BLUE}` : '';
  const hookTag = lastHookName ? `  ${CSI}36m${lastHookName}${RESET}${BG_BLUE}` : '';
  const status = `  [${icon}${BG_BLUE}]`;
  const rawLen = label.length + help.length + copilotStatus.length + 10 + (autoSwitchMode ? 7 : 0) + (toolTag ? 7 : 0) + (lastHookName ? lastHookName.length + 4 : 0);
  const pad = Math.max(0, cols - rawLen);
  // Reset any in-progress attributes to avoid corrupting game escape sequences
  return `${RESET}${CSI}s${CSI}${rows};1H` +
    `${BG_BLUE}${WHITE}${BOLD}${label}${RESET}` +
    `${BG_BLUE}${DIM}${help}${RESET}` +
    `${BG_BLUE}${autoTag}${toolTag}${hookTag}${status}${BG_BLUE}` +
    `${BG_BLUE}${' '.repeat(pad)}${RESET}` +
    `${CSI}u`;
}

/** @returns {void} */
function drawStatusBar() {
  process.stdout.write(getStatusBarSequence());
}

/** @returns {void} */
function scheduleStatusBarRedraw() {
  if (statusBarTimer) return;
  drawStatusBar();
  statusBarTimer = setTimeout(() => { statusBarTimer = null; }, 80);
}

// ── Fun screen (game menu) ─────────────────────────────────────────────────
/** @returns {void} */
function drawFunScreen() {
  const cols = getCols();
  const rows = getRows();
  setScrollRegion();
  process.stdout.write(CLEAR + HIDE_CURSOR);
  /**
   * @param {string} text
   * @param {number} [rawLen]
   * @returns {string}
   */
  function center(text, rawLen) {
    return ' '.repeat(Math.max(0, Math.floor((cols - (rawLen || text.length)) / 2))) + text;
  }
  /** @type {string[]} */
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
    const pfx = sel ? `${BG_BRIGHT_YELLOW}${BLACK}${BOLD} \u25B8 ` : '   ';
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
/**
 * Launch a WASM game by ID.
 * @param {string} gameId - The game identifier (e.g. 'mines', 'sudoku')
 * @returns {void}
 */
function launchGame(gameId) {
  activeScreen = 'game';
  lastGameId = gameId;
  const gameDef = GAMES.find(g => g.id === gameId);
  const isJsGame = gameDef && gameDef.type === 'js';
  const gameFile = gameDef && gameDef.path ? gameDef.path : isJsGame ? path.join(GAMES_DIR, `${gameId}.js`) : path.join(WASM_DIR, `${gameId}.js`);
  const cols = getCols();
  const rows = getRows() - 1;
  setScrollRegion();
  process.stdout.write(CLEAR);
  createGameVTerm();
  /** @type {Record<string, string>} */
  const gameEnv = { ...process.env, TERM: 'xterm-256color', LINES: String(rows), COLS: String(cols) };
  if (gameId === 'sudoku') gameEnv.SUDOKU_FASTGEN = '1';
  /** @type {string[]} */
  const supportsN = ['fifteen', 'mines', 'reversi', 'checkers', 'sos', 'revenge'];
  /** @type {string[]} */
  const gameArgs = isJsGame ? [gameFile] : gameId === 'sudoku' ? [gameFile, '-f'] : supportsN.includes(gameId) ? [gameFile, '-n'] : [gameFile];
  gameProcess = pty.spawn('node', gameArgs, {
    name: 'xterm-256color', cols, rows, cwd: process.cwd(),
    env: gameEnv,
  });
  gameProcess.onData((/** @type {string} */ data) => {
    if (gameVterm) gameVterm.write(data);
    if (activeScreen === 'game') {
      if (!statusBarTimer) {
        process.stdout.write(data + getStatusBarSequence());
        statusBarTimer = setTimeout(() => { statusBarTimer = null; }, 80);
      } else {
        process.stdout.write(data);
      }
    }
  });
  gameProcess.onExit(() => {
    gameProcess = null;
    gameVterm = null;
    if (activeScreen === 'game') {
      activeScreen = 'fun';
      drawFunScreen();
    }
  });
  drawStatusBar();
}

/** @returns {void} */
function pauseGame() { activeScreen = 'fun'; drawFunScreen(); }

/** @returns {boolean} */
function resumeGame() {
  if (!gameProcess) return false;
  activeScreen = 'game';
  setScrollRegion();
  process.stdout.write(serializeVTerm(gameVterm) + getStatusBarSequence());
  return true;
}

/** @returns {void} */
function destroyGame() {
  if (gameProcess) { try { gameProcess.destroy(); } catch (_) { } gameProcess = null; }
  gameVterm = null;
}

// ── Copilot PTY ─────────────────────────────────────────────────────────────
/** @returns {void} */
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
  ptyProcess.onData((/** @type {string} */ data) => {
    if (vterm) vterm.write(data);
    if (activeScreen === 'copilot') {
      const cleaned = data.replace(FOCUS_RE, '');
      if (cleaned) {
        if (!statusBarTimer) {
          process.stdout.write(cleaned + getStatusBarSequence());
          statusBarTimer = setTimeout(() => { statusBarTimer = null; }, 80);
        } else {
          process.stdout.write(cleaned);
        }
      }
    }
  });
  ptyProcess.onExit((/** @type {{ exitCode: number }} */ { exitCode }) => { cleanup(); process.exit(exitCode || 0); });
}

// ── Screen switching ────────────────────────────────────────────────────────
/** @returns {void} */
function switchToFun() { activeScreen = 'fun'; drawFunScreen(); }

/** @returns {void} */
function switchToCopilot() {
  activeScreen = 'copilot';
  setScrollRegion();
  process.stdout.write(serializeVTerm(vterm) + getStatusBarSequence());
}

/**
 * Recalculate sizes for all PTYs and virtual terminals, then redraw the active screen.
 * Used on both resize events and Ctrl-G toggle to ensure consistent rendering.
 * @returns {Promise<void>}
 */
async function recalculateAndRedraw() {
  const cols = getCols();
  const rows = getRows() - 1;
  // Force a real resize by briefly changing size by 10 cols, then restoring.
  // This forces child PTY processes (like copilot GUI) to actually redraw.
  if (ptyProcess) ptyProcess.resize(Math.max(1, cols - 10), rows);
  if (gameProcess) gameProcess.resize(Math.max(1, cols - 10), rows);

  await new Promise(r => setTimeout(r, 50));

  if (ptyProcess) ptyProcess.resize(cols, rows);
  if (vterm) vterm.resize(cols, rows);
  if (gameProcess) gameProcess.resize(cols, rows);
  if (gameVterm) gameVterm.resize(cols, rows);

  if (activeScreen === 'copilot') { setScrollRegion(); process.stdout.write(serializeVTerm(vterm) + getStatusBarSequence()); }
  else if (activeScreen === 'fun') drawFunScreen();
  else if (activeScreen === 'game') { setScrollRegion(); process.stdout.write(serializeVTerm(gameVterm) + getStatusBarSequence()); }
}

/**
 * Toggle between copilot and game screens.
 * Skips the menu: copilot <-> game directly.
 * If no game is running, auto-launches the last played game or shows the menu.
 * @returns {void}
 */
function toggle() {
  if (activeScreen === 'copilot') {
    if (gameProcess) {
      activeScreen = 'game';
      recalculateAndRedraw();
    } else if (lastGameId) {
      launchGame(lastGameId);
    } else {
      switchToFun();
    }
  } else if (activeScreen === 'fun') {
    activeScreen = 'copilot';
    recalculateAndRedraw();
  } else if (activeScreen === 'game') {
    activeScreen = 'copilot';
    recalculateAndRedraw();
  }
}

// ── Input handling ──────────────────────────────────────────────────────────
/** @returns {void} */
function setupInput() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding(null);

  process.stdin.on('data', (/** @type {Buffer | string} */ data) => {
    const bytes = Buffer.from(data);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x07) { toggle(); return; }
      if (bytes[i] === 0x13) {
        autoSwitchMode = !autoSwitchMode;
        if (autoSwitchMode) handleAutoSwitch();
        scheduleStatusBarRedraw();
        return;
      }
    }
    if (activeScreen === 'copilot' && ptyProcess) {
      ptyProcess.write(data.toString());
      // On Enter, if auto-switch is on, trigger an immediate fast-poll or switch
      if (autoSwitchMode && bytes.some(b => b === 0x0d || b === 0x0a)) {
        setTimeout(handleAutoSwitch, 100); // Small delay to let the hook fire
      }
      return;
    }
    if (activeScreen === 'game' && gameProcess) {
      if (bytes.length === 1 && (bytes[0] === 0x71 || bytes[0] === 0x1b)) { destroyGame(); activeScreen = 'fun'; drawFunScreen(); return; }
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
        if (ch === 0x71 || ch === 0x1b) { destroyGame(); switchToCopilot(); return; }
      }
    }
  });
}

// ── Resize ──────────────────────────────────────────────────────────────────
process.stdout.on('resize', recalculateAndRedraw);

// ── Cleanup ─────────────────────────────────────────────────────────────────
/** @returns {void} */
function cleanup() {
  resetScrollRegion();
  process.stdout.write(SHOW_CURSOR + RESET + OSC_PROGRESS_DONE);
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch (_) { } }
  if (statusPollInterval) clearInterval(statusPollInterval);
  if (statusBarTimer) clearTimeout(statusBarTimer);
  destroyGame();
  cleanupHooks();
}

process.on('SIGINT', () => {
  const now = Date.now();
  if (activeScreen === 'game') {
    destroyGame(); activeScreen = 'fun'; drawFunScreen();
  } else if (activeScreen === 'fun') {
    switchToCopilot();
  } else if (activeScreen === 'copilot' && ptyProcess) {
    if (now - ctrlCTime < 1000) { cleanup(); process.exit(0); }
    ptyProcess.write('\x03');
  }
  ctrlCTime = now;
});
process.on('exit', cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// ── Main ────────────────────────────────────────────────────────────────────
setupHomeDirs();
installPrompts();
installHooks();
pollCopilotStatus();
process.stdout.write(CLEAR);

if (YOLO_FLAG) {
  /** @type {string[]} */
  const yoloWarning = [
    `${BOLD}${YELLOW}\u26A0  YOLO MODE ENABLED  \u26A0${RESET}`,
    '',
    `${CYAN}You are granting Copilot CLI the following permissions:${RESET}`,
    '',
    `  ${BOLD}\u2022${RESET} Edit, create, and delete files ${DIM}(no confirmation)${RESET}`,
    `  ${BOLD}\u2022${RESET} Run arbitrary shell commands ${DIM}(no confirmation)${RESET}`,
    `  ${BOLD}\u2022${RESET} Install packages and dependencies ${DIM}(no confirmation)${RESET}`,
    `  ${BOLD}\u2022${RESET} All tool use prompts auto-accepted ${DIM}(copilot --yolo)${RESET}`,
    '',
    `${YELLOW}${BOLD}\u26A0  Copilot will act autonomously without asking.${RESET}`,
    '',
    `${DIM}Starting in 3 seconds... (Ctrl-C to abort)${RESET}`,
  ];
  const cols = getCols();
  const rows = getRows();
  const startRow = Math.max(1, Math.floor(rows / 2) - Math.floor(yoloWarning.length / 2));
  for (let i = 0; i < yoloWarning.length; i++) {
    const line = yoloWarning[i];
    const rawLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const cx = Math.max(0, Math.floor((cols - rawLen) / 2));
    process.stdout.write(`${CSI}${startRow + i};${cx + 1}H${line}`);
  }
  COPILOT_ARGS.push('--yolo');
  setTimeout(() => { process.stdout.write(CLEAR); drawStatusBar(); startCopilot(); }, 3000);
} else {
  drawStatusBar();
  startCopilot();
}
setupInput();

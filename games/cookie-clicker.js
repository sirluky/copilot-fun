#!/usr/bin/env node
// @game.id cookie-clicker
// @game.name Cookie Clicker
// @game.desc Click cookies, buy upgrades & factories, collect achievements
// @game.controls Space/Enter to click, Arrow keys to navigate, B to buy, R to reset
// @game.goal Bake as many cookies as possible and unlock all upgrades
// @game.similar Cookie Clicker

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROWS = parseInt(process.env.LINES) || 23;
const COLS = parseInt(process.env.COLS) || 80;
const CSI = '\x1b[';

// Colors
const RESET = `${CSI}0m`;
const BOLD = `${CSI}1m`;
const DIM = `${CSI}2m`;
const RED = `${CSI}31m`;
const GREEN = `${CSI}32m`;
const YELLOW = `${CSI}33m`;
const BLUE = `${CSI}34m`;
const MAGENTA = `${CSI}35m`;
const CYAN = `${CSI}36m`;
const WHITE = `${CSI}37m`;
const BG_YELLOW = `${CSI}43m`;
const BG_BLUE = `${CSI}44m`;

// Game state file
const STATE_DIR = path.join(os.homedir(), '.copilot-fun');
const STATE_FILE = path.join(STATE_DIR, 'cookie-clicker-save.json');

// Factories that generate cookies over time
const FACTORIES = [
  { id: 'cursor', name: 'Cursor', baseCost: 15, cps: 0.1, emoji: '👆' },
  { id: 'grandma', name: 'Grandma', baseCost: 100, cps: 1, emoji: '👵' },
  { id: 'farm', name: 'Farm', baseCost: 500, cps: 8, emoji: '🚜' },
  { id: 'mine', name: 'Mine', baseCost: 3000, cps: 47, emoji: '⛏️' },
  { id: 'factory', name: 'Factory', baseCost: 10000, cps: 260, emoji: '🏭' },
  { id: 'bank', name: 'Bank', baseCost: 40000, cps: 1400, emoji: '🏦' },
  { id: 'temple', name: 'Temple', baseCost: 200000, cps: 7800, emoji: '⛩️' },
  { id: 'wizard', name: 'Wizard Tower', baseCost: 1666666, cps: 44000, emoji: '🧙' },
];

// Click upgrades (multiply click power)
const UPGRADES = [
  { id: 'steel_cursor', name: 'Steel Cursor', cost: 100, clickMult: 2, desc: '2x click power', requires: 1 },
  { id: 'gold_cursor', name: 'Gold Cursor', cost: 500, clickMult: 3, desc: '3x click power', requires: 10 },
  { id: 'diamond_cursor', name: 'Diamond Cursor', cost: 5000, clickMult: 5, desc: '5x click power', requires: 50 },
  { id: 'mega_click', name: 'Mega Click', cost: 50000, clickMult: 10, desc: '10x click power', requires: 100 },
];

// Achievements (collectibles)
const ACHIEVEMENTS = [
  { id: 'first_click', name: 'First Click', desc: 'Click your first cookie', check: (s) => s.totalClicks >= 1 },
  { id: 'baker', name: 'Baker', desc: 'Bake 100 cookies', check: (s) => s.totalCookies >= 100 },
  { id: 'factory_owner', name: 'Factory Owner', desc: 'Own 10 factories total', check: (s) => s.totalFactories >= 10 },
  { id: 'clicker', name: 'Clicker', desc: 'Click 1,000 times', check: (s) => s.totalClicks >= 1000 },
  { id: 'millionaire', name: 'Millionaire', desc: 'Bake 1 million cookies', check: (s) => s.totalCookies >= 1000000 },
  { id: 'full_team', name: 'Full Team', desc: 'Own at least one of each factory', check: (s) => FACTORIES.every(f => s.factories[f.id] >= 1) },
  { id: 'power_clicker', name: 'Power Clicker', desc: 'Get 100 cookies per click', check: (s) => s.clickPower >= 100 },
];

// Game state
let state = {
  cookies: 0,
  totalCookies: 0,
  totalClicks: 0,
  clickPower: 1,
  factories: {},
  upgrades: [],
  achievements: [],
  lastTick: Date.now(),
  totalFactories: 0,
};

// UI state
let selectedTab = 0; // 0=factories, 1=upgrades, 2=achievements
let selectedItem = 0;
let notification = null;
let notificationTime = 0;

// Initialize factories
FACTORIES.forEach(f => { state.factories[f.id] = 0; });

function loadState() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const loaded = JSON.parse(data);
      Object.assign(state, loaded);
      state.lastTick = Date.now();
    }
  } catch (e) {
    // Start fresh on error
  }
}

function saveState() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    // Silent fail
  }
}

function cleanup() {
  saveState();
  process.stdout.write(`${CSI}?25h${RESET}`);
}
process.on('exit', cleanup);

function moveTo(row, col) {
  process.stdout.write(`${CSI}${row};${col}H`);
}

function formatNumber(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function getCost(factory) {
  const count = state.factories[factory.id];
  return Math.floor(factory.baseCost * Math.pow(1.15, count));
}

function getCPS() {
  let total = 0;
  FACTORIES.forEach(f => {
    total += f.cps * state.factories[f.id];
  });
  return total;
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!state.achievements.includes(ach.id) && ach.check(state)) {
      state.achievements.push(ach.id);
      showNotification(`🏆 Achievement: ${ach.name}!`);
    }
  });
}

function showNotification(msg) {
  notification = msg;
  notificationTime = Date.now();
}

function tick() {
  const now = Date.now();
  const delta = (now - state.lastTick) / 1000;
  state.lastTick = now;
  
  const cps = getCPS();
  const generated = cps * delta;
  state.cookies += generated;
  state.totalCookies += generated;
  
  checkAchievements();
}

function clickCookie() {
  state.cookies += state.clickPower;
  state.totalCookies += state.clickPower;
  state.totalClicks++;
  checkAchievements();
}

function buyFactory(factory) {
  const cost = getCost(factory);
  if (state.cookies >= cost) {
    state.cookies -= cost;
    state.factories[factory.id]++;
    state.totalFactories++;
    showNotification(`Bought ${factory.name}!`);
    checkAchievements();
    return true;
  }
  return false;
}

function buyUpgrade(upgrade) {
  if (state.upgrades.includes(upgrade.id)) return false;
  if (state.totalClicks < upgrade.requires) return false;
  if (state.cookies >= upgrade.cost) {
    state.cookies -= upgrade.cost;
    state.upgrades.push(upgrade.id);
    state.clickPower *= upgrade.clickMult;
    showNotification(`Upgraded: ${upgrade.name}!`);
    checkAchievements();
    return true;
  }
  return false;
}

function resetGame() {
  state.cookies = 0;
  state.totalCookies = 0;
  state.totalClicks = 0;
  state.clickPower = 1;
  state.totalFactories = 0;
  FACTORIES.forEach(f => { state.factories[f.id] = 0; });
  state.upgrades = [];
  state.achievements = [];
  state.lastTick = Date.now();
  showNotification('Game reset!');
  saveState();
}

function render() {
  process.stdout.write(`${CSI}2J${CSI}H${CSI}?25l`);
  
  const startRow = 2;
  const startCol = 2;
  
  // Title & Cookie display
  moveTo(startRow, startCol);
  process.stdout.write(`${BOLD}${YELLOW}🍪 COOKIE CLICKER 🍪${RESET}`);
  
  moveTo(startRow + 1, startCol);
  process.stdout.write(`${GREEN}${BOLD}${formatNumber(state.cookies)}${RESET} cookies`);
  
  moveTo(startRow + 2, startCol);
  process.stdout.write(`${CYAN}${formatNumber(getCPS())} per second${RESET}`);
  
  moveTo(startRow + 3, startCol);
  process.stdout.write(`${WHITE}Click Power: ${BOLD}${state.clickPower}${RESET}`);
  
  // Notification
  if (notification && Date.now() - notificationTime < 3000) {
    moveTo(startRow + 4, startCol);
    process.stdout.write(`${BG_BLUE}${WHITE} ${notification} ${RESET}`);
  }
  
  // Tabs
  const tabs = ['Factories', 'Upgrades', 'Achievements'];
  moveTo(startRow + 6, startCol);
  tabs.forEach((tab, i) => {
    if (i === selectedTab) {
      process.stdout.write(`${BG_YELLOW}${BOLD} ${tab} ${RESET} `);
    } else {
      process.stdout.write(`${DIM} ${tab} ${RESET} `);
    }
  });
  
  // Content area
  const contentRow = startRow + 8;
  const maxItems = ROWS - contentRow - 3;
  
  if (selectedTab === 0) {
    // Factories
    moveTo(contentRow, startCol);
    process.stdout.write(`${DIM}Arrow keys to navigate, B to buy, Space/Enter to click cookie${RESET}`);
    
    FACTORIES.slice(0, maxItems).forEach((f, i) => {
      const row = contentRow + 2 + i;
      const cost = getCost(f);
      const count = state.factories[f.id];
      const canBuy = state.cookies >= cost;
      const selected = i === selectedItem && selectedTab === 0;
      
      moveTo(row, startCol);
      const prefix = selected ? `${BG_BLUE}${WHITE}▶${RESET}` : ' ';
      const color = canBuy ? GREEN : DIM;
      const name = `${f.emoji} ${f.name}`;
      const info = `${count} owned | ${formatNumber(cost)} cookies | +${formatNumber(f.cps)}/s`;
      
      process.stdout.write(`${prefix} ${color}${name.padEnd(18)}${RESET} ${info}`);
    });
  } else if (selectedTab === 1) {
    // Upgrades
    moveTo(contentRow, startCol);
    process.stdout.write(`${DIM}Arrow keys to navigate, B to buy${RESET}`);
    
    UPGRADES.slice(0, maxItems).forEach((u, i) => {
      const row = contentRow + 2 + i;
      const owned = state.upgrades.includes(u.id);
      const canBuy = !owned && state.cookies >= u.cost && state.totalClicks >= u.requires;
      const selected = i === selectedItem && selectedTab === 1;
      
      moveTo(row, startCol);
      const prefix = selected ? `${BG_BLUE}${WHITE}▶${RESET}` : ' ';
      let color = DIM;
      if (owned) color = YELLOW;
      else if (canBuy) color = GREEN;
      
      const status = owned ? '[OWNED]' : `${formatNumber(u.cost)} cookies`;
      const reqs = state.totalClicks >= u.requires ? '' : ` (need ${u.requires} clicks)`;
      
      process.stdout.write(`${prefix} ${color}${u.name.padEnd(18)}${RESET} ${status} - ${u.desc}${reqs}`);
    });
  } else if (selectedTab === 2) {
    // Achievements
    moveTo(contentRow, startCol);
    process.stdout.write(`${DIM}${state.achievements.length}/${ACHIEVEMENTS.length} achievements unlocked${RESET}`);
    
    ACHIEVEMENTS.slice(0, maxItems).forEach((a, i) => {
      const row = contentRow + 2 + i;
      const unlocked = state.achievements.includes(a.id);
      
      moveTo(row, startCol);
      const icon = unlocked ? `${YELLOW}🏆${RESET}` : `${DIM}🔒${RESET}`;
      const color = unlocked ? WHITE : DIM;
      
      process.stdout.write(`${icon} ${color}${a.name.padEnd(18)}${RESET} - ${a.desc}`);
    });
  }
  
  // Bottom controls
  moveTo(ROWS - 1, startCol);
  process.stdout.write(`${DIM}Tab/←→: Switch tabs | ↑↓: Navigate | Space/Enter: Click | B: Buy | R: Reset | Q/ESC: Quit${RESET}`);
  
  // Stats in corner
  moveTo(startRow, COLS - 30);
  process.stdout.write(`${DIM}Total: ${formatNumber(state.totalCookies)} | Clicks: ${state.totalClicks}${RESET}`);
}

// Input handling
process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on('data', (key) => {
  const k = key.toString();
  
  // Click cookie
  if (k === ' ' || k === '\r') {
    clickCookie();
  }
  // Tab switching
  else if (k === '\x1b[C' || k === '\t') { // right arrow or tab
    selectedTab = (selectedTab + 1) % 3;
    selectedItem = 0;
  }
  else if (k === '\x1b[D') { // left arrow
    selectedTab = (selectedTab - 1 + 3) % 3;
    selectedItem = 0;
  }
  // Item navigation
  else if (k === '\x1b[A') { // up
    const maxItems = selectedTab === 0 ? FACTORIES.length : selectedTab === 1 ? UPGRADES.length : ACHIEVEMENTS.length;
    selectedItem = Math.max(0, selectedItem - 1);
  }
  else if (k === '\x1b[B') { // down
    const maxItems = selectedTab === 0 ? FACTORIES.length : selectedTab === 1 ? UPGRADES.length : ACHIEVEMENTS.length;
    selectedItem = Math.min(maxItems - 1, selectedItem + 1);
  }
  // Buy
  else if (k === 'b' || k === 'B') {
    if (selectedTab === 0) {
      buyFactory(FACTORIES[selectedItem]);
    } else if (selectedTab === 1) {
      buyUpgrade(UPGRADES[selectedItem]);
    }
  }
  // Reset
  else if (k === 'r' || k === 'R') {
    resetGame();
  }
  
  render();
});

// Game loop
loadState();
setInterval(() => {
  tick();
  render();
  saveState();
}, 100);

render();

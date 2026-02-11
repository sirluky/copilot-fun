#!/usr/bin/env node
// @game.id 2048
// @game.name 2048
// @game.desc Slide tiles to create 2048
// @game.controls Arrow keys/WASD to move, R to restart
// @game.goal Combine tiles to reach 2048
// @game.similar 2048 (Gabriele Cirulli)

const ROWS = parseInt(process.env.LINES) || 23;
const COLS = parseInt(process.env.COLS) || 80;
const CSI = '\x1b[';

// ANSI Color codes for each tile value
const TILE_COLORS = {
  0: { fg: 37, bg: 100 },    // Empty - gray
  2: { fg: 30, bg: 107 },    // White
  4: { fg: 30, bg: 103 },    // Yellow
  8: { fg: 97, bg: 43 },     // Orange
  16: { fg: 97, bg: 41 },    // Red
  32: { fg: 97, bg: 45 },    // Magenta
  64: { fg: 97, bg: 44 },    // Blue
  128: { fg: 97, bg: 46 },   // Cyan
  256: { fg: 97, bg: 42 },   // Green
  512: { fg: 97, bg: 43 },   // Dark yellow
  1024: { fg: 97, bg: 45 },  // Bright magenta
  2048: { fg: 30, bg: 103 }, // Gold
  4096: { fg: 97, bg: 41 },  // Bright red
  8192: { fg: 97, bg: 44 }   // Bright blue
};

let grid = [];
let score = 0;
let bestScore = 0;
let gameOver = false;
let won = false;

function initGrid() {
  grid = Array(4).fill(0).map(() => Array(4).fill(0));
  score = 0;
  gameOver = false;
  won = false;
  addRandomTile();
  addRandomTile();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length > 0) {
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
}

function rotate90(grid) {
  const n = grid.length;
  const rotated = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = grid[r][c];
    }
  }
  return rotated;
}

function moveLeft(grid) {
  let moved = false;
  let points = 0;
  const newGrid = Array(4).fill(0).map(() => Array(4).fill(0));
  
  for (let r = 0; r < 4; r++) {
    const row = grid[r].filter(v => v !== 0);
    let col = 0;
    let merged = [false, false, false, false];
    
    for (let i = 0; i < row.length; i++) {
      if (col > 0 && !merged[col - 1] && newGrid[r][col - 1] === row[i]) {
        newGrid[r][col - 1] *= 2;
        points += newGrid[r][col - 1];
        if (newGrid[r][col - 1] === 2048 && !won) won = true;
        merged[col - 1] = true;
      } else {
        newGrid[r][col] = row[i];
        col++;
      }
    }
    
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] !== newGrid[r][c]) moved = true;
    }
  }
  
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      grid[r][c] = newGrid[r][c];
    }
  }
  
  return { moved, points };
}

function move(direction) {
  let tempGrid = grid.map(r => [...r]);
  let rotations = 0;
  
  if (direction === 'up') rotations = 3;
  else if (direction === 'right') rotations = 2;
  else if (direction === 'down') rotations = 1;
  
  for (let i = 0; i < rotations; i++) {
    tempGrid = rotate90(tempGrid);
  }
  
  const { moved, points } = moveLeft(tempGrid);
  
  for (let i = 0; i < (4 - rotations) % 4; i++) {
    tempGrid = rotate90(tempGrid);
  }
  
  grid = tempGrid;
  
  if (moved) {
    score += points;
    if (score > bestScore) bestScore = score;
    addRandomTile();
    checkGameOver();
  }
}

function checkGameOver() {
  // Check for empty cells
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return;
    }
  }
  
  // Check for possible merges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = grid[r][c];
      if ((c < 3 && grid[r][c + 1] === val) ||
          (r < 3 && grid[r + 1][c] === val)) {
        return;
      }
    }
  }
  
  gameOver = true;
}

function drawTile(screenRow, screenCol, value) {
  const colors = TILE_COLORS[value] || TILE_COLORS[0];
  const fg = colors.fg;
  const bg = colors.bg;
  
  const text = value === 0 ? '' : String(value);
  const cellWidth = 7;
  const cellHeight = 3;
  
  for (let line = 0; line < cellHeight; line++) {
    process.stdout.write(`${CSI}${screenRow + line};${screenCol}H`);
    
    if (line === 1) {
      const padding = Math.floor((cellWidth - text.length) / 2);
      const paddedText = ' '.repeat(padding) + text + ' '.repeat(cellWidth - padding - text.length);
      process.stdout.write(`${CSI}${fg};${bg}m${paddedText}${CSI}0m`);
    } else {
      process.stdout.write(`${CSI}${fg};${bg}m${' '.repeat(cellWidth)}${CSI}0m`);
    }
  }
}

function render() {
  // Clear screen and hide cursor
  process.stdout.write(`${CSI}2J${CSI}H${CSI}?25l`);
  
  const startRow = Math.floor(ROWS / 2) - 9;
  const startCol = Math.floor(COLS / 2) - 17;
  
  // Title
  process.stdout.write(`${CSI}${startRow - 3};${startCol}H${CSI}1;96m`);
  process.stdout.write('╔════════════════════════════════╗');
  process.stdout.write(`${CSI}${startRow - 2};${startCol}H║`);
  process.stdout.write(`${CSI}1;93m          2048 GAME            ${CSI}1;96m║`);
  process.stdout.write(`${CSI}${startRow - 1};${startCol}H╚════════════════════════════════╝${CSI}0m`);
  
  // Score display
  process.stdout.write(`${CSI}${startRow};${startCol}H${CSI}1;97m Score: ${CSI}1;92m${score}${CSI}0m`);
  process.stdout.write(`  ${CSI}1;97mBest: ${CSI}1;93m${bestScore}${CSI}0m`);
  
  // Draw grid with borders
  const gridTop = startRow + 2;
  const gridLeft = startCol;
  
  // Top border
  process.stdout.write(`${CSI}${gridTop};${gridLeft}H${CSI}36m┌───────┬───────┬───────┬───────┐${CSI}0m`);
  
  for (let r = 0; r < 4; r++) {
    const tileRow = gridTop + 1 + r * 4;
    
    // Draw 3 rows for each tile
    for (let line = 0; line < 3; line++) {
      process.stdout.write(`${CSI}${tileRow + line};${gridLeft}H${CSI}36m│${CSI}0m`);
      
      for (let c = 0; c < 4; c++) {
        const colors = TILE_COLORS[grid[r][c]] || TILE_COLORS[0];
        const text = grid[r][c] === 0 ? '' : String(grid[r][c]);
        
        if (line === 1) {
          const padding = Math.floor((7 - text.length) / 2);
          const paddedText = ' '.repeat(padding) + text + ' '.repeat(7 - padding - text.length);
          process.stdout.write(`${CSI}${colors.fg};${colors.bg}m${paddedText}${CSI}0m`);
        } else {
          process.stdout.write(`${CSI}${colors.fg};${colors.bg}m       ${CSI}0m`);
        }
        
        process.stdout.write(`${CSI}36m│${CSI}0m`);
      }
    }
    
    // Row separator
    if (r < 3) {
      process.stdout.write(`${CSI}${tileRow + 3};${gridLeft}H${CSI}36m├───────┼───────┼───────┼───────┤${CSI}0m`);
    }
  }
  
  // Bottom border
  const bottomRow = gridTop + 16;
  process.stdout.write(`${CSI}${bottomRow};${gridLeft}H${CSI}36m└───────┴───────┴───────┴───────┘${CSI}0m`);
  
  // Game status
  if (won && !gameOver) {
    process.stdout.write(`${CSI}${bottomRow + 2};${startCol}H${CSI}1;92m`);
    process.stdout.write('  🎉 YOU WIN! Keep playing... 🎉  ');
  } else if (gameOver) {
    process.stdout.write(`${CSI}${bottomRow + 2};${startCol}H${CSI}1;91m`);
    process.stdout.write('    💀 GAME OVER - Press R 💀    ');
  }
  
  // Controls
  process.stdout.write(`${CSI}${bottomRow + 4};${startCol}H${CSI}2m`);
  process.stdout.write('Arrow/WASD:Move  R:Restart  Q:Quit');
  process.stdout.write(`${CSI}0m`);
}

// Input handling
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (gameOver) {
    if (key === 'r' || key === 'R') {
      initGrid();
      render();
    }
    return;
  }
  
  if (key === '\x1b[A' || key === 'w' || key === 'W') {
    move('up');
  } else if (key === '\x1b[B' || key === 's' || key === 'S') {
    move('down');
  } else if (key === '\x1b[C' || key === 'd' || key === 'D') {
    move('right');
  } else if (key === '\x1b[D' || key === 'a' || key === 'A') {
    move('left');
  } else if (key === 'r' || key === 'R') {
    initGrid();
  }
  
  render();
});

// Cleanup on exit
process.on('exit', () => {
  process.stdout.write(`${CSI}?25h${CSI}0m${CSI}2J${CSI}H`);
});

// Start game
initGrid();
render();

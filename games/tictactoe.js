#!/usr/bin/env node
// @game.id tictactoe
// @game.name Tic-Tac-Toe
// @game.desc Classic 3x3 game with computer opponent
// @game.controls Arrow keys/WASD to move, Enter to place, R to restart, M to toggle mode
// @game.goal Get 3 in a row before your opponent
// @game.similar Tic-Tac-Toe

const ROWS = parseInt(process.env.LINES) || 23;
const COLS = parseInt(process.env.COLS) || 80;
const CSI = '\x1b[';

// Game state
let board = Array(9).fill(null); // null, 'X', or 'O'
let currentPlayer = 'X'; // X always goes first
let cursor = 4; // center position
let gameOver = false;
let winner = null;
let vsComputer = true; // Default: play against computer

// Colors
const RESET = `${CSI}0m`;
const BOLD = `${CSI}1m`;
const DIM = `${CSI}2m`;
const RED = `${CSI}31m`;
const GREEN = `${CSI}32m`;
const YELLOW = `${CSI}33m`;
const BLUE = `${CSI}34m`;
const CYAN = `${CSI}36m`;
const BG_BLUE = `${CSI}44m`;

function cleanup() {
  process.stdout.write(`${CSI}?25h${RESET}`);
}
process.on('exit', cleanup);

function render() {
  process.stdout.write(`${CSI}2J${CSI}H${CSI}?25l`);
  
  const startRow = Math.floor(ROWS / 2) - 6;
  const startCol = Math.floor(COLS / 2) - 12;
  
  // Title
  moveTo(startRow, startCol);
  process.stdout.write(`${BOLD}${CYAN}TIC-TAC-TOE${RESET}`);
  
  // Mode indicator
  moveTo(startRow + 1, startCol);
  const mode = vsComputer ? `${YELLOW}vs Computer${RESET}` : `${GREEN}Two Player${RESET}`;
  process.stdout.write(`Mode: ${mode} ${DIM}(M to toggle)${RESET}`);
  
  // Draw board
  const boardStartRow = startRow + 3;
  const boardStartCol = startCol;
  
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const pos = row * 3 + col;
      const r = boardStartRow + row * 2;
      const c = boardStartCol + col * 4;
      
      // Highlight cursor position
      const isCursor = pos === cursor && !gameOver;
      const cellBg = isCursor ? BG_BLUE : '';
      
      moveTo(r, c);
      
      const mark = board[pos];
      if (mark === 'X') {
        process.stdout.write(`${cellBg}${RED}${BOLD} X ${RESET}`);
      } else if (mark === 'O') {
        process.stdout.write(`${cellBg}${BLUE}${BOLD} O ${RESET}`);
      } else {
        process.stdout.write(`${cellBg}${DIM} ${pos + 1} ${RESET}`);
      }
      
      // Vertical separator
      if (col < 2) {
        process.stdout.write(`${DIM}│${RESET}`);
      }
    }
    
    // Horizontal separator
    if (row < 2) {
      moveTo(boardStartRow + row * 2 + 1, boardStartCol);
      process.stdout.write(`${DIM}───┼───┼───${RESET}`);
    }
  }
  
  // Status message
  moveTo(boardStartRow + 7, startCol);
  if (gameOver) {
    if (winner) {
      const winColor = winner === 'X' ? RED : BLUE;
      process.stdout.write(`${BOLD}${winColor}${winner} WINS!${RESET} ${DIM}Press R to restart${RESET}`);
    } else {
      process.stdout.write(`${YELLOW}${BOLD}DRAW!${RESET} ${DIM}Press R to restart${RESET}`);
    }
  } else {
    const playerColor = currentPlayer === 'X' ? RED : BLUE;
    const turn = vsComputer && currentPlayer === 'O' ? 'Computer' : `Player ${currentPlayer}`;
    process.stdout.write(`${playerColor}${BOLD}${turn}'s turn${RESET}`);
  }
  
  // Controls
  moveTo(boardStartRow + 9, startCol);
  process.stdout.write(`${DIM}Arrow keys: move  Enter: place  R: restart  M: mode${RESET}`);
}

function moveTo(row, col) {
  process.stdout.write(`${CSI}${row};${col}H`);
}

function checkWinner() {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]              // diagonals
  ];
  
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  
  return null;
}

function minimax(isMaximizing, depth = 0) {
  const result = checkWinner();
  if (result === 'O') return 10 - depth;
  if (result === 'X') return depth - 10;
  if (result === 'draw') return 0;
  
  const player = isMaximizing ? 'O' : 'X';
  let bestScore = isMaximizing ? -Infinity : Infinity;
  
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = player;
      const score = minimax(!isMaximizing, depth + 1);
      board[i] = null;
      
      if (isMaximizing) {
        bestScore = Math.max(score, bestScore);
      } else {
        bestScore = Math.min(score, bestScore);
      }
    }
  }
  
  return bestScore;
}

function computerMove() {
  let bestScore = -Infinity;
  let bestMove = null;
  
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      const score = minimax(false);
      board[i] = null;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  
  if (bestMove !== null) {
    board[bestMove] = 'O';
    currentPlayer = 'X';
    
    const result = checkWinner();
    if (result) {
      gameOver = true;
      winner = result === 'draw' ? null : result;
    }
    render();
  }
}

function placeMarker() {
  if (gameOver || board[cursor] !== null) return;
  
  board[cursor] = currentPlayer;
  
  const result = checkWinner();
  if (result) {
    gameOver = true;
    winner = result === 'draw' ? null : result;
    render();
    return;
  }
  
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  render();
  
  // Computer's turn
  if (vsComputer && currentPlayer === 'O' && !gameOver) {
    setTimeout(() => computerMove(), 300);
  }
}

function restart() {
  board = Array(9).fill(null);
  currentPlayer = 'X';
  cursor = 4;
  gameOver = false;
  winner = null;
  render();
}

function toggleMode() {
  vsComputer = !vsComputer;
  restart();
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  // Arrow keys
  if (key === '\x1b[A' || key === 'w' || key === 'W') {
    if (cursor >= 3) cursor -= 3;
  } else if (key === '\x1b[B' || key === 's' || key === 'S') {
    if (cursor < 6) cursor += 3;
  } else if (key === '\x1b[C' || key === 'd' || key === 'D') {
    if (cursor % 3 < 2) cursor++;
  } else if (key === '\x1b[D' || key === 'a' || key === 'A') {
    if (cursor % 3 > 0) cursor--;
  } else if (key === '\r' || key === ' ') {
    placeMarker();
    return;
  } else if (key === 'r' || key === 'R') {
    restart();
    return;
  } else if (key === 'm' || key === 'M') {
    toggleMode();
    return;
  }
  
  render();
});

render();

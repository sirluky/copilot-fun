#!/usr/bin/env node
// @game.id pong
// @game.name Prediction Pong
// @game.desc Guess where the ball will land on your paddle
// @game.controls Arrow keys / WASD to position paddle, Enter to confirm guess
// @game.goal Predict the ball's return position and place your paddle correctly
// @game.similar Pong (prediction variant)

const ROWS = parseInt(process.env.LINES) || 23;
const COLS = parseInt(process.env.COLS) || 80;
const CSI = '\x1b[';
const BOLD = `${CSI}1m`;
const DIM = `${CSI}2m`;
const RESET = `${CSI}0m`;
const CYAN = `${CSI}36m`;
const GREEN = `${CSI}32m`;
const YELLOW = `${CSI}33m`;
const RED = `${CSI}31m`;
const WHITE = `${CSI}37m`;
const BG_BLUE = `${CSI}44m`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;

// ── Game constants ──────────────────────────────────────────────────────────
const FIELD_TOP = 3;
const FIELD_BOTTOM = ROWS - 2;
const FIELD_LEFT = 2;
const FIELD_RIGHT = COLS - 1;
const FIELD_HEIGHT = FIELD_BOTTOM - FIELD_TOP + 1;
const FIELD_WIDTH = FIELD_RIGHT - FIELD_LEFT + 1;
const PADDLE_SIZE = 5;
const BALL_CHAR = '●';
const PADDLE_CHAR = '█';
const TICK_MS = 60;

// ── Game state ──────────────────────────────────────────────────────────────

/** @type {'watching' | 'guessing' | 'revealing' | 'gameover'} */
let phase = 'watching';
let score = 0;
let lives = 3;
let round = 0;

// Ball state
let ballX = 0;
let ballY = 0;
let ballDX = 0;
let ballDY = 0;

// Which side the ball is heading toward (0 = left, 1 = right)
let targetSide = 0;

// Paddles (row positions = top of paddle)
let leftPaddleY = Math.floor(FIELD_TOP + FIELD_HEIGHT / 2 - PADDLE_SIZE / 2);
let rightPaddleY = Math.floor(FIELD_TOP + FIELD_HEIGHT / 2 - PADDLE_SIZE / 2);

// Player's guess paddle position
let guessY = Math.floor(FIELD_TOP + FIELD_HEIGHT / 2 - PADDLE_SIZE / 2);

// Actual landing position (computed when ball stops)
let landingY = 0;

let gameInterval = null;
let animFrame = 0;
let message = '';
let messageColor = GREEN;

// ── Helpers ─────────────────────────────────────────────────────────────────
function moveTo(r, c) { process.stdout.write(`${CSI}${r};${c}H`); }
function clearScreen() { process.stdout.write(`${CSI}2J${CSI}H${HIDE_CURSOR}`); }

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function drawBorder() {
  // Top border
  moveTo(FIELD_TOP - 1, FIELD_LEFT - 1);
  process.stdout.write(`${DIM}${'─'.repeat(FIELD_WIDTH + 2)}${RESET}`);
  // Bottom border
  moveTo(FIELD_BOTTOM + 1, FIELD_LEFT - 1);
  process.stdout.write(`${DIM}${'─'.repeat(FIELD_WIDTH + 2)}${RESET}`);
  // Side borders
  for (let r = FIELD_TOP; r <= FIELD_BOTTOM; r++) {
    moveTo(r, FIELD_LEFT - 1);
    process.stdout.write(`${DIM}│${RESET}`);
    moveTo(r, FIELD_RIGHT + 1);
    process.stdout.write(`${DIM}│${RESET}`);
  }
}

function drawPaddle(col, topRow, color) {
  for (let i = 0; i < PADDLE_SIZE; i++) {
    const r = topRow + i;
    if (r >= FIELD_TOP && r <= FIELD_BOTTOM) {
      moveTo(r, col);
      process.stdout.write(`${color}${PADDLE_CHAR}${RESET}`);
    }
  }
}

function drawBall() {
  const r = Math.round(ballY);
  const c = Math.round(ballX);
  if (r >= FIELD_TOP && r <= FIELD_BOTTOM && c >= FIELD_LEFT && c <= FIELD_RIGHT) {
    moveTo(r, c);
    process.stdout.write(`${BOLD}${WHITE}${BALL_CHAR}${RESET}`);
  }
}

function drawHUD() {
  moveTo(1, 1);
  process.stdout.write(`${CSI}2K`);
  const scoreStr = `${BOLD}${CYAN}PREDICTION PONG${RESET}  ${YELLOW}Score: ${score}${RESET}  ${RED}Lives: ${'♥'.repeat(lives)}${'♡'.repeat(3 - lives)}${RESET}  ${DIM}Round: ${round}${RESET}`;
  process.stdout.write(scoreStr);

  moveTo(2, 1);
  process.stdout.write(`${CSI}2K`);
  if (phase === 'watching') {
    process.stdout.write(`${DIM}Watch the ball...${RESET}`);
  } else if (phase === 'guessing') {
    const side = targetSide === 0 ? 'LEFT' : 'RIGHT';
    process.stdout.write(`${BOLD}${YELLOW}↕ Position your ${side} paddle, then press ENTER${RESET}`);
  } else if (phase === 'revealing') {
    process.stdout.write(`${messageColor}${message}${RESET}`);
  }
}

function render() {
  clearScreen();
  drawBorder();

  // Draw paddles
  if (phase === 'guessing') {
    // Show the catching paddle and a ghost for the guess
    if (targetSide === 0) {
      drawPaddle(FIELD_LEFT, guessY, `${BOLD}${CYAN}`);
      drawPaddle(FIELD_RIGHT, rightPaddleY, DIM);
    } else {
      drawPaddle(FIELD_LEFT, leftPaddleY, DIM);
      drawPaddle(FIELD_RIGHT, guessY, `${BOLD}${CYAN}`);
    }
  } else if (phase === 'revealing') {
    // Show guess paddle and actual landing
    if (targetSide === 0) {
      drawPaddle(FIELD_LEFT, guessY, `${BOLD}${CYAN}`);
      drawPaddle(FIELD_RIGHT, rightPaddleY, DIM);
      // Show where ball actually lands
      const landR = clamp(landingY, FIELD_TOP, FIELD_BOTTOM);
      moveTo(landR, FIELD_LEFT);
      process.stdout.write(`${BOLD}${YELLOW}◄${RESET}`);
    } else {
      drawPaddle(FIELD_LEFT, leftPaddleY, DIM);
      drawPaddle(FIELD_RIGHT, guessY, `${BOLD}${CYAN}`);
      const landR = clamp(landingY, FIELD_TOP, FIELD_BOTTOM);
      moveTo(landR, FIELD_RIGHT);
      process.stdout.write(`${BOLD}${YELLOW}►${RESET}`);
    }
  } else {
    drawPaddle(FIELD_LEFT, leftPaddleY, GREEN);
    drawPaddle(FIELD_RIGHT, rightPaddleY, GREEN);
  }

  if (phase === 'watching') {
    drawBall();
  }

  if (phase === 'gameover') {
    const centerR = Math.floor(FIELD_TOP + FIELD_HEIGHT / 2);
    const msg1 = 'GAME OVER';
    const msg2 = `Final Score: ${score}`;
    const msg3 = 'Press ENTER to play again';
    moveTo(centerR - 1, Math.floor((COLS - msg1.length) / 2));
    process.stdout.write(`${BOLD}${RED}${msg1}${RESET}`);
    moveTo(centerR, Math.floor((COLS - msg2.length) / 2));
    process.stdout.write(`${BOLD}${YELLOW}${msg2}${RESET}`);
    moveTo(centerR + 1, Math.floor((COLS - msg3.length) / 2));
    process.stdout.write(`${DIM}${msg3}${RESET}`);
  }

  drawHUD();
}

// ── Game logic ──────────────────────────────────────────────────────────────
function startRound() {
  round++;
  phase = 'watching';

  // Ball starts from a random side
  const fromLeft = Math.random() > 0.5;
  targetSide = fromLeft ? 1 : 0; // ball goes to opposite side

  ballX = fromLeft ? FIELD_LEFT + 2 : FIELD_RIGHT - 2;
  ballY = FIELD_TOP + Math.floor(Math.random() * FIELD_HEIGHT);

  // Random angle
  const speed = 0.8 + Math.min(round * 0.05, 0.7);
  const angle = (Math.random() * 0.8 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
  ballDX = fromLeft ? speed : -speed;
  ballDY = angle;

  // Position the "serving" paddle centered on ball
  if (fromLeft) {
    leftPaddleY = clamp(Math.round(ballY) - Math.floor(PADDLE_SIZE / 2), FIELD_TOP, FIELD_BOTTOM - PADDLE_SIZE + 1);
  } else {
    rightPaddleY = clamp(Math.round(ballY) - Math.floor(PADDLE_SIZE / 2), FIELD_TOP, FIELD_BOTTOM - PADDLE_SIZE + 1);
  }

  guessY = Math.floor(FIELD_TOP + FIELD_HEIGHT / 2 - PADDLE_SIZE / 2);

  render();
  startBallAnimation();
}

function startBallAnimation() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    ballX += ballDX;
    ballY += ballDY;

    // Bounce off top/bottom
    if (ballY <= FIELD_TOP) { ballY = FIELD_TOP; ballDY = Math.abs(ballDY); }
    if (ballY >= FIELD_BOTTOM) { ballY = FIELD_BOTTOM; ballDY = -Math.abs(ballDY); }

    // Check if ball reached the target side
    const reached = targetSide === 0
      ? ballX <= FIELD_LEFT + 1
      : ballX >= FIELD_RIGHT - 1;

    if (reached) {
      stopBallAnimation();
      landingY = Math.round(ballY);
      // Position the "catching" side's AI paddle on the ball (it always catches)
      if (targetSide === 0) {
        leftPaddleY = clamp(landingY - Math.floor(PADDLE_SIZE / 2), FIELD_TOP, FIELD_BOTTOM - PADDLE_SIZE + 1);
      } else {
        rightPaddleY = clamp(landingY - Math.floor(PADDLE_SIZE / 2), FIELD_TOP, FIELD_BOTTOM - PADDLE_SIZE + 1);
      }
      // Ball stops — now player guesses return position
      startGuessingPhase();
      return;
    }

    render();
  }, TICK_MS);
}

function stopBallAnimation() {
  if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
}

function startGuessingPhase() {
  // Ball is caught. Now it will be "returned" — player must guess where it lands
  // Compute where the return ball will actually land
  const returnFromLeft = targetSide === 0;
  const startX = returnFromLeft ? FIELD_LEFT + 2 : FIELD_RIGHT - 2;
  const startY = landingY;

  // Random return angle
  const speed = 0.8 + Math.min(round * 0.05, 0.7);
  const angle = (Math.random() * 0.8 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
  const dx = returnFromLeft ? speed : -speed;
  const dy = angle;

  // Simulate the return path to find landing position
  let simX = startX;
  let simY = startY;
  let simDY = dy;
  while (true) {
    simX += dx;
    simY += simDY;
    if (simY <= FIELD_TOP) { simY = FIELD_TOP; simDY = Math.abs(simDY); }
    if (simY >= FIELD_BOTTOM) { simY = FIELD_BOTTOM; simDY = -Math.abs(simDY); }
    const reachedEnd = returnFromLeft
      ? simX >= FIELD_RIGHT - 1
      : simX <= FIELD_LEFT + 1;
    if (reachedEnd) break;
  }
  landingY = Math.round(simY);

  // Now the player has to guess — target side flips
  targetSide = returnFromLeft ? 1 : 0;
  phase = 'guessing';
  render();
}

function checkGuess() {
  const paddleTop = guessY;
  const paddleBottom = guessY + PADDLE_SIZE - 1;
  const hit = landingY >= paddleTop && landingY <= paddleBottom;
  const distance = hit ? 0 : Math.min(Math.abs(landingY - paddleTop), Math.abs(landingY - paddleBottom));

  phase = 'revealing';
  if (hit) {
    const centerDist = Math.abs(landingY - (paddleTop + Math.floor(PADDLE_SIZE / 2)));
    const points = centerDist === 0 ? 3 : centerDist <= 1 ? 2 : 1;
    score += points;
    message = points === 3 ? '★ PERFECT! +3' : points === 2 ? '✦ Great! +2' : '✓ Caught! +1';
    messageColor = points === 3 ? `${BOLD}${YELLOW}` : points === 2 ? `${BOLD}${GREEN}` : GREEN;
  } else {
    lives--;
    message = `✗ Missed by ${distance}! -1 life`;
    messageColor = RED;
  }

  render();

  if (lives <= 0) {
    setTimeout(() => { phase = 'gameover'; render(); }, 1500);
  } else {
    setTimeout(() => { startRound(); }, 1500);
  }
}

function resetGame() {
  score = 0;
  lives = 3;
  round = 0;
  startRound();
}

// ── Input ───────────────────────────────────────────────────────────────────
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (phase === 'guessing') {
    const minY = FIELD_TOP;
    const maxY = FIELD_BOTTOM - PADDLE_SIZE + 1;
    if (key === '\x1b[A' || key === 'w' || key === 'W' || key === 'k') {
      guessY = clamp(guessY - 1, minY, maxY);
      render();
    } else if (key === '\x1b[B' || key === 's' || key === 'S' || key === 'j') {
      guessY = clamp(guessY + 1, minY, maxY);
      render();
    } else if (key === '\r') {
      checkGuess();
    }
  } else if (phase === 'gameover') {
    if (key === '\r') {
      resetGame();
    }
  }
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
function cleanup() {
  stopBallAnimation();
  process.stdout.write(`${SHOW_CURSOR}${RESET}`);
}
process.on('exit', cleanup);

// ── Start ───────────────────────────────────────────────────────────────────
startRound();

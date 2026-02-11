# 🎮 Games Guide

All games are compiled to WebAssembly from [nbsdgames](https://github.com/abakh/nbsdgames) (CC0 public domain).
They run entirely in Node.js — no native binaries or C compiler needed.

Only **turn-based** games are included, perfect for playing during pauses while waiting for Copilot.

## Universal Controls

All games share these common controls:

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor / navigate |
| W / ↑ | Move up |
| A / ← | Move left |
| S / ↓ | Move down |
| D / → | Move right |
| H/J/K/L | Vim-style movement (left/down/up/right) |
| Enter | Confirm / select / act |
| Q | Quit game (returns to menu) |
| Ctrl-G | Pause game & return to menu (game stays alive!) |
| F1 | In-game help (controls) |
| F2 | In-game help (gameplay) |

### Game Menu Controls

| Key | Action |
|-----|--------|
| ↑↓ / W/S | Navigate game list |
| Enter | Launch game (or resume paused game) |
| N | Start new game (replaces paused game) |
| Q | Return to Copilot |
| Ctrl-G | Toggle between Copilot and game menu |

---

## Fifteen Puzzle

**Similar to:** 15-Puzzle, Sliding Puzzle

Slide numbered tiles on a grid to arrange them in numerical order.
The empty space allows adjacent tiles to be slid into position.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor to a tile |
| Enter | Slide the selected tile toward the empty space |

**Goal:** Arrange all tiles in ascending order (1, 2, 3, ...) with the empty space in the bottom-right corner.

**Tip:** Work row by row from top to bottom. Get the first row in place, then the second, etc.

---

## Mines

**Similar to:** Minesweeper (Windows)

Uncover cells on a grid without hitting any hidden mines.
Numbers reveal how many mines are adjacent to that cell.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| Enter | Reveal a cell |
| Space | Flag/unflag a cell as a mine |

**Goal:** Reveal all safe cells. Use the number clues to deduce where mines are hiding.

**Tip:** Start from the edges. If a "1" has only one unrevealed neighbor, that neighbor is a mine.

---

## Sudoku

**Similar to:** Sudoku

Fill a 9×9 grid so every row, column, and 3×3 box contains the digits 1-9 exactly once.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| 1-9 | Place a digit |
| Space / 0 | Clear a cell |

**Goal:** Complete the grid with valid digits. No repeats in any row, column, or box.

**Tip:** Look for rows/columns/boxes that are almost complete — they have the fewest possibilities.

---

## Reversi

**Similar to:** Othello

Place discs to capture your opponent's pieces by flanking them.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| Enter | Place a disc |

**Goal:** Have the most discs of your color when the board is full. A valid move must flip at least one opponent disc.

**Tip:** Corners are the most valuable positions — they can never be flipped. Avoid giving your opponent corner access.

---

## Checkers

**Similar to:** Draughts, English Checkers

Move diagonally and jump over opponent pieces to capture them.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| Enter | Select piece, then select destination |

**Goal:** Capture all opponent pieces or block them from moving. Pieces that reach the far side become "kings" and can move backward.

**Tip:** Keep your back row intact as long as possible to prevent opponent kings.

---

## SOS

**Similar to:** Tic-Tac-Toe (extended variant)

Take turns placing 'S' or 'O' on a grid to form the sequence S-O-S.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| S | Place an 'S' |
| O | Place an 'O' |

**Goal:** Form more S-O-S sequences (horizontal, vertical, or diagonal) than your opponent.

**Tip:** Try to set up positions where placing one letter creates multiple S-O-S patterns at once.

---

## Battleship

**Similar to:** Battleship (board game by Milton Bradley)

Take turns firing at a grid to find and sink your opponent's hidden ships.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move targeting cursor |
| Enter | Fire at the selected cell |

**Goal:** Sink all of your opponent's ships before they sink yours.

**Tip:** When you get a hit, fire at adjacent cells to find the rest of the ship. Ships are always straight (horizontal or vertical).

---

## Memoblocks

**Similar to:** Concentration, Memory Game, Pexeso

Flip cards to find matching pairs.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move cursor |
| Enter | Flip a card |

**Goal:** Match all pairs with the fewest flips possible. Two cards are shown briefly — remember their positions!

**Tip:** Systematically work through the grid. Focus on remembering the first few cards you flip.

---

## Rabbit Hole

**Similar to:** Maze Runner, Labyrinth

Navigate through a maze as a rabbit collecting items.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move through the maze |

**Goal:** Find your way through the maze and collect all items along the way.

---

## Revenge

**Similar to:** Sokoban, Puzzle Box

Push blocks around a grid to solve spatial puzzles.

| Control | Action |
|---------|--------|
| Arrow keys / WASD / HJKL | Move your character |
| Enter | Push a block |

**Goal:** Push blocks to their target positions to complete each level.

**Tip:** Plan your moves carefully — you can only push blocks, not pull them. Avoid pushing blocks into corners where they get stuck.

---

## 2048

**Similar to:** 2048 (Gabriele Cirulli)

Slide tiles on a 4x4 grid to combine them and reach the 2048 tile.

| Control | Action |
|---------|--------|
| Arrow keys / WASD | Slide tiles in the chosen direction |
| R | Restart game |

**Goal:** Combine tiles with the same number to create larger numbers. The game is won when a tile with the value 2048 is created.

---

## Cookie Clicker

**Similar to:** Cookie Clicker

Bake cookies by clicking, then spend them on upgrades and buildings to bake even more.

| Control | Action |
|---------|--------|
| Space / Enter | Click the cookie to bake |
| Arrow keys | Navigate through upgrades and buildings |
| B | Buy the selected item |
| R | Reset game |

**Goal:** Bake as many cookies as possible and unlock all achievements and upgrades.

---

## Tic-Tac-Toe

**Similar to:** Tic-Tac-Toe

Classic game where two players take turns marking spaces in a 3x3 grid.

| Control | Action |
|---------|--------|
| Arrow keys / WASD | Move cursor |
| Enter | Place your mark (X or O) |
| R | Restart game |
| M | Toggle AI opponent mode |

**Goal:** Get three of your marks in a horizontal, vertical, or diagonal row.

---

## Technical Notes

### How WASM Games Work

Each game is a C program originally using ncurses for terminal I/O. We compile them to WebAssembly using Emscripten with a custom ncurses shim (`wasm/curses.h`) that maps all curses calls to ANSI escape codes:

- `initscr()` → enters alternate screen buffer
- `mvaddch()` / `mvprintw()` → ANSI cursor positioning + output
- `getch()` → async stdin read via Emscripten ASYNCIFY
- Colors → ANSI 16-color escape sequences
- Box drawing → ASCII fallback characters

### Platform Support

The WASM games run on any platform with Node.js 18+:
- ✅ Linux
- ✅ macOS
- ✅ Windows (via Windows Terminal, PowerShell, or WSL)
- ✅ Any terminal emulator supporting ANSI escape codes

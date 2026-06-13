import { BOARD_SIZE, COLORS, DIRECTIONS, opponentOf } from './constants.js';

export function createInitialBoard(size = BOARD_SIZE) {
  const cells = Array.from({ length: size }, () => Array(size).fill(null));
  const left = size / 2 - 1;
  const right = size / 2;
  cells[left][left] = COLORS.white;
  cells[right][right] = COLORS.white;
  cells[left][right] = COLORS.black;
  cells[right][left] = COLORS.black;
  return cells;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function isInside(row, col, size = BOARD_SIZE) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

export function isCorner(row, col, size = BOARD_SIZE) {
  return (row === 0 || row === size - 1) && (col === 0 || col === size - 1);
}

export function isEdge(row, col, size = BOARD_SIZE) {
  return row === 0 || col === 0 || row === size - 1 || col === size - 1;
}

export function coordKey(row, col) {
  return `${row}:${col}`;
}

export function findFlips(board, color, row, col, protectedKeys = new Set()) {
  return collectFlips(board, color, row, col, protectedKeys).flips;
}

function collectFlips(board, color, row, col, protectedKeys = new Set()) {
  const size = board.length;
  if (!isInside(row, col, size) || board[row][col]) return { flips: [], wouldFlipCount: 0 };

  const opponent = opponentOf(color);
  const flips = [];
  let wouldFlipCount = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    const line = [];

    while (isInside(r, c, size) && board[r][c] === opponent) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    if (line.length > 0 && isInside(r, c, size) && board[r][c] === color) {
      wouldFlipCount += line.length;
      for (const [fr, fc] of line) {
        if (!protectedKeys.has(coordKey(fr, fc))) {
          flips.push([fr, fc]);
        }
      }
    }
  }

  return { flips, wouldFlipCount };
}

export function findLegalMoves(board, color, blockedKeys = new Set(), protectedKeys = new Set()) {
  const moves = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (blockedKeys.has(coordKey(row, col))) continue;
      const result = collectFlips(board, color, row, col, protectedKeys);
      if (result.wouldFlipCount > 0) {
        moves.push({ row, col, flips: result.flips });
      }
    }
  }
  return moves;
}

export function placeDisc(board, color, row, col, protectedKeys = new Set()) {
  const { flips, wouldFlipCount } = collectFlips(board, color, row, col, protectedKeys);
  if (wouldFlipCount === 0) {
    return { ok: false, board, flips: [] };
  }

  const next = cloneBoard(board);
  next[row][col] = color;
  for (const [fr, fc] of flips) {
    next[fr][fc] = color;
  }

  return { ok: true, board: next, flips };
}

export function countDiscs(board) {
  const counts = { black: 0, white: 0, empty: 0 };
  for (const row of board) {
    for (const cell of row) {
      if (cell === COLORS.black) counts.black += 1;
      else if (cell === COLORS.white) counts.white += 1;
      else counts.empty += 1;
    }
  }
  return counts;
}

export function boardWinner(board) {
  const counts = countDiscs(board);
  if (counts.black > counts.white) return COLORS.black;
  if (counts.white > counts.black) return COLORS.white;
  return 'draw';
}

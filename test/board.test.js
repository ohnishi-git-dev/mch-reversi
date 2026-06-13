import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../src/core/constants.js';
import { createInitialBoard, findLegalMoves, placeDisc } from '../src/core/board.js';

test('initial 6x6 board has four legal moves for black', () => {
  const board = createInitialBoard();
  const moves = findLegalMoves(board, COLORS.black);
  assert.equal(moves.length, 4);
});

test('placing a disc flips bracketed opponent discs', () => {
  const board = createInitialBoard();
  const result = placeDisc(board, COLORS.black, 1, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.flips, [[2, 2]]);
  assert.equal(result.board[1][2], COLORS.black);
  assert.equal(result.board[2][2], COLORS.black);
});

test('protected discs are not flipped but the move remains legal', () => {
  const board = createInitialBoard();
  const protectedKeys = new Set(['2:2']);
  const result = placeDisc(board, COLORS.black, 1, 2, protectedKeys);
  assert.equal(result.ok, true);
  assert.deepEqual(result.flips, []);
  assert.equal(result.board[2][2], COLORS.white);
});

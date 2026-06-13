import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, LANES } from '../src/core/constants.js';
import { applyMove, applySkill, createMatch, getActiveLane } from '../src/core/match.js';

function newMatch() {
  return createMatch({
    playerColor: COLORS.black,
    playerHeroIds: ['nobunaga', 'napoleon', 'washington'],
    cpuHeroIds: ['cao-cao', 'davinci', 'joan'],
    difficulty: 'easy',
  });
}

test('turn order advances black/white on each lane before next lane', () => {
  let match = newMatch();
  assert.equal(getActiveLane(match), 'left');
  assert.equal(match.activeColor, COLORS.black);

  match = applyMove(match, 1, 2).match;
  assert.equal(getActiveLane(match), 'left');
  assert.equal(match.activeColor, COLORS.white);

  match = applyMove(match, 1, 1).match;
  assert.equal(getActiveLane(match), 'center');
  assert.equal(match.activeColor, COLORS.black);
});

test('placing a stone awards gauge to current lane hero only', () => {
  const result = applyMove(newMatch(), 1, 2);
  assert.equal(result.ok, true);
  assert.equal(result.match.sides.black.heroes.left.gauge, 1);
  assert.equal(result.match.sides.black.heroes.center.gauge, 0);
  assert.equal(result.match.sides.black.heroes.right.gauge, 0);
});

test('edge placement adds edge gauge bonus', () => {
  const match = newMatch();
  const result = applyMove(match, 1, 2);
  assert.equal(result.ok, true);
  assert.equal(result.match.sides.black.heroes.left.gauge, 1);
});

test('grant gauge skill gives +8 to another ally and consumes source turn', () => {
  const match = newMatch();
  match.sides.black.heroes.center.gauge = 10;
  const result = applySkill(match, 'center', {
    type: 'grantGauge',
    sourceLane: 'center',
    targetColor: COLORS.black,
    targetLane: 'right',
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.sides.black.heroes.center.gauge, 0);
  assert.equal(result.match.sides.black.heroes.right.gauge, 8);
  assert.equal(result.match.activeColor, COLORS.white);
  assert.equal(getActiveLane(result.match), 'left');
});

test('block skill marks an enemy legal move as blocked for that enemy only', () => {
  const match = newMatch();
  match.sides.black.heroes.left.gauge = 10;
  const result = applySkill(match, 'left', {
    type: 'block',
    sourceLane: 'left',
    targetLane: 'left',
    row: 3,
    col: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.lanes.left.blockedCells.length, 1);
  assert.equal(result.match.lanes.left.blockedCells[0].targetColor, COLORS.white);
});

test('all lanes are present in a new match', () => {
  const match = newMatch();
  assert.deepEqual(Object.keys(match.lanes), LANES);
});

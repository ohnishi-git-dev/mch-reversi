import { LANES, opponentOf } from './constants.js';
import { countDiscs, isCorner, isEdge } from './board.js';
import {
  applyMove,
  applySkill,
  getActiveLane,
  getLegalMovesFor,
  getUsableSkills,
} from './match.js';

export function chooseCpuAction(match) {
  const color = match.activeColor;
  const difficulty = match.difficulty;
  const lane = getActiveLane(match);
  const skills = getUsableSkills(match, color);
  const moves = getLegalMovesFor(match, color, lane);

  if (skills.length > 0) {
    const skillAction = chooseSkillAction(match, color, skills, difficulty);
    if (skillAction && (moves.length === 0 || shouldPreferSkill(difficulty))) {
      return skillAction;
    }
  }

  if (moves.length > 0) {
    return {
      kind: 'move',
      move: chooseMove(match, color, lane, moves, difficulty),
    };
  }

  if (skills.length > 0) {
    const skillAction = chooseSkillAction(match, color, skills, difficulty);
    if (skillAction) return skillAction;
  }

  return { kind: 'pass' };
}

export function runCpuAction(match) {
  const action = chooseCpuAction(match);
  if (action.kind === 'move') {
    return applyMove(match, action.move.row, action.move.col);
  }
  if (action.kind === 'skill') {
    return applySkill(match, action.sourceLane, action.payload);
  }
  return { match, ok: false, message: 'CPU has no action' };
}

function chooseMove(match, color, lane, moves, difficulty) {
  if (difficulty === 'easy') return randomItem(moves);

  const scored = moves.map((move) => ({
    move,
    score: scoreMove(match, color, lane, move, difficulty),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

function scoreMove(match, color, lane, move, difficulty) {
  let score = move.flips.length * 3;
  if (isCorner(move.row, move.col)) score += 60;
  else if (isEdge(move.row, move.col)) score += 12;

  if (difficulty === 'hard') {
    const laneState = match.lanes[lane];
    const counts = countDiscs(laneState.board);
    const beforeLead = counts[color] - counts[opponentOf(color)];
    const afterLead = beforeLead + 1 + move.flips.length * 2;
    score += afterLead;
  }

  return score;
}

function chooseSkillAction(match, color, skills, difficulty) {
  const ordered = difficulty === 'easy' ? shuffle(skills) : skills.slice();

  for (const skill of ordered) {
    const hero = skill.hero;
    const payload = payloadForSkill(match, color, skill.lane, hero, difficulty);
    if (payload) {
      return { kind: 'skill', sourceLane: skill.lane, payload };
    }
  }
  return null;
}

function payloadForSkill(match, color, sourceLane, hero, difficulty) {
  if (hero.skillType === 'grantGauge') {
    const candidates = LANES.filter((lane) => lane !== sourceLane && !match.lanes[lane].ended);
    if (candidates.length === 0) return null;
    const targetLane = difficulty === 'easy'
      ? randomItem(candidates)
      : candidates.sort((a, b) => match.sides[color].heroes[b].gauge - match.sides[color].heroes[a].gauge)[0];
    return { type: 'grantGauge', sourceLane, targetColor: color, targetLane };
  }

  if (hero.skillType === 'drainGauge') {
    const enemyColor = opponentOf(color);
    const candidates = LANES.filter((lane) => !match.lanes[lane].ended);
    if (candidates.length === 0) return null;
    const targetLane = difficulty === 'easy'
      ? randomItem(candidates)
      : candidates.sort((a, b) => match.sides[enemyColor].heroes[b].gauge - match.sides[enemyColor].heroes[a].gauge)[0];
    return { type: 'drainGauge', sourceLane, targetColor: enemyColor, targetLane };
  }

  if (hero.skillType === 'block') {
    const enemyColor = opponentOf(color);
    const lanes = LANES.filter((lane) => !match.lanes[lane].ended);
    const options = lanes.flatMap((lane) =>
      getLegalMovesFor(match, enemyColor, lane)
        .filter((move) => !hero.blockNoCorners || !isCorner(move.row, move.col))
        .map((move) => ({ lane, move })),
    );
    if (options.length === 0) return null;
    const option = difficulty === 'easy'
      ? randomItem(options)
      : options.sort((a, b) => scoreMove(match, enemyColor, b.lane, b.move, 'normal') - scoreMove(match, enemyColor, a.lane, a.move, 'normal'))[0];
    return { type: 'block', sourceLane, targetLane: option.lane, row: option.move.row, col: option.move.col };
  }

  if (hero.skillType === 'protect') {
    const lanes = LANES.filter((lane) => !match.lanes[lane].ended);
    const options = lanes.flatMap((lane) => {
      const board = match.lanes[lane].board;
      const cells = [];
      for (let row = 0; row < board.length; row += 1) {
        for (let col = 0; col < board[row].length; col += 1) {
          if (!board[row][col]) continue;
          if (hero.protectEdgesOnly && !isEdge(row, col)) continue;
          cells.push({ lane, row, col, color: board[row][col] });
        }
      }
      return cells;
    });
    if (options.length === 0) return null;
    const owned = options.filter((option) => option.color === color);
    const option = difficulty === 'easy' ? randomItem(options) : randomItem(owned.length ? owned : options);
    return { type: 'protect', sourceLane, targetLane: option.lane, row: option.row, col: option.col };
  }

  return null;
}

function shouldPreferSkill(difficulty) {
  if (difficulty === 'easy') return Math.random() < 0.35;
  if (difficulty === 'normal') return Math.random() < 0.5;
  return Math.random() < 0.65;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

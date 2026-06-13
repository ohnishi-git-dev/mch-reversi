import {
  BOARD_SIZE,
  COLORS,
  LANES,
  SKILL_COST,
  SKILL_MAX,
  opponentOf,
} from './constants.js';
import {
  boardWinner,
  coordKey,
  countDiscs,
  createInitialBoard,
  findLegalMoves,
  isCorner,
  isEdge,
  placeDisc,
} from './board.js';
import { getHero } from './heroes.js';

export function createMatch({ playerColor, playerHeroIds, cpuHeroIds, difficulty = 'easy' }) {
  const blackOwner = playerColor === COLORS.black ? 'player' : 'cpu';
  const whiteOwner = playerColor === COLORS.white ? 'player' : 'cpu';

  return {
    status: 'playing',
    winner: null,
    resultReason: null,
    playerColor,
    difficulty,
    activeColor: COLORS.black,
    activeLaneIndex: 0,
    log: ['試合開始'],
    sides: {
      black: {
        owner: blackOwner,
        heroes: buildSideHeroes(blackOwner === 'player' ? playerHeroIds : cpuHeroIds),
      },
      white: {
        owner: whiteOwner,
        heroes: buildSideHeroes(whiteOwner === 'player' ? playerHeroIds : cpuHeroIds),
      },
    },
    lanes: Object.fromEntries(
      LANES.map((lane) => [
        lane,
        {
          id: lane,
          board: createInitialBoard(BOARD_SIZE),
          ended: false,
          winner: null,
          protectedCells: [],
          blockedCells: [],
        },
      ]),
    ),
  };
}

function buildSideHeroes(heroIds) {
  return Object.fromEntries(
    LANES.map((lane, index) => [
      lane,
      {
        heroId: heroIds[index],
        gauge: 0,
      },
    ]),
  );
}

export function cloneMatch(match) {
  return structuredClone(match);
}

export function getActiveLane(match) {
  return LANES[match.activeLaneIndex];
}

export function getCurrentOwner(match) {
  return match.sides[match.activeColor].owner;
}

export function getHeroFor(match, color, lane) {
  const state = match.sides[color].heroes[lane];
  return { ...state, definition: getHero(state.heroId), color, lane };
}

export function laneProtectedKeys(laneState) {
  return new Set(laneState.protectedCells.map((cell) => coordKey(cell.row, cell.col)));
}

export function laneBlockedKeys(laneState, color) {
  return new Set(
    laneState.blockedCells
      .filter((cell) => cell.targetColor === color)
      .map((cell) => coordKey(cell.row, cell.col)),
  );
}

export function getLegalMovesFor(match, color, lane) {
  const laneState = match.lanes[lane];
  if (laneState.ended) return [];
  return findLegalMoves(
    laneState.board,
    color,
    laneBlockedKeys(laneState, color),
    laneProtectedKeys(laneState),
  );
}

export function getUsableSkills(match, color) {
  return LANES.flatMap((lane) => {
    if (match.lanes[lane].ended) return [];
    const heroState = getHeroFor(match, color, lane);
    if (heroState.gauge < SKILL_COST) return [];
    return [{ color, lane, hero: heroState.definition, gauge: heroState.gauge }];
  });
}

export function applyMove(match, row, col) {
  const next = cloneMatch(match);
  if (next.status !== 'playing') return { match: next, ok: false, message: '試合は終了しています。' };

  const color = next.activeColor;
  const lane = getActiveLane(next);
  const laneState = next.lanes[lane];
  if (laneState.ended) return { match: next, ok: false, message: 'この盤面は終局済みです。' };

  clearExpiringEffectsAtTurnStart(next, color, lane);

  const move = placeDisc(laneState.board, color, row, col, laneProtectedKeys(laneState));
  if (!move.ok) return { match: next, ok: false, message: 'そこには置けません。' };

  laneState.board = move.board;
  removeOpponentProtectedCellsAfterPlacement(next, color, lane);
  clearBlocksForTurn(next, color, lane);
  awardGauge(next, color, lane, row, col, move.flips.length);
  next.log.unshift(`${labelForColor(color)}が${labelForLane(lane)}に配置: ${move.flips.length}枚反転`);

  finishAction(next);
  return { match: next, ok: true };
}

export function applySkill(match, sourceLane, payload) {
  const next = cloneMatch(match);
  if (next.status !== 'playing') return { match: next, ok: false, message: '試合は終了しています。' };

  const color = next.activeColor;
  const activeLane = getActiveLane(next);
  const heroState = next.sides[color].heroes[sourceLane];
  const sourceHero = getHero(heroState?.heroId);

  if (!sourceHero) return { match: next, ok: false, message: 'ヒーローが見つかりません。' };
  if (next.lanes[sourceLane].ended) return { match: next, ok: false, message: '終局済み盤面のヒーローは使えません。' };
  if (heroState.gauge < SKILL_COST) return { match: next, ok: false, message: 'ゲージが足りません。' };

  clearExpiringEffectsAtTurnStart(next, color, activeLane);

  const validation = validateSkillTarget(next, color, sourceHero, payload);
  if (!validation.ok) return { match: next, ok: false, message: validation.message };

  heroState.gauge = 0;
  executeSkill(next, color, sourceHero, payload);
  clearBlocksForTurn(next, color, activeLane);
  next.log.unshift(`${labelForColor(color)} ${sourceHero.shortName}: ${sourceHero.skillName}`);

  finishAction(next);
  return { match: next, ok: true };
}

export function applyAutoPass(match) {
  const next = cloneMatch(match);
  const color = next.activeColor;
  const lane = getActiveLane(next);
  clearExpiringEffectsAtTurnStart(next, color, lane);
  clearBlocksForTurn(next, color, lane);
  next.log.unshift(`${labelForColor(color)} ${labelForLane(lane)}: パス`);
  finishAction(next);
  return { match: next, ok: true };
}

export function shouldAutoPass(match) {
  if (match.status !== 'playing') return false;
  const color = match.activeColor;
  const lane = getActiveLane(match);
  return getLegalMovesFor(match, color, lane).length === 0 && getUsableSkills(match, color).length === 0;
}

function awardGauge(match, color, lane, row, col, flipCount) {
  const hero = match.sides[color].heroes[lane];
  let gain = 1 + Math.floor(flipCount / 2);
  if (isCorner(row, col, BOARD_SIZE)) gain += 2;
  else if (isEdge(row, col, BOARD_SIZE)) gain += 1;
  hero.gauge = Math.min(SKILL_MAX, hero.gauge + gain);
}

function validateSkillTarget(match, color, hero, payload) {
  if (!payload || !payload.type) return { ok: false, message: '対象が選択されていません。' };

  if (hero.skillType !== payload.type) {
    return { ok: false, message: 'スキル種別と対象が一致しません。' };
  }

  if (payload.type === 'block') {
    const lane = match.lanes[payload.targetLane];
    if (!lane || lane.ended) return { ok: false, message: '対象盤面を選べません。' };
    if (hero.blockNoCorners && isCorner(payload.row, payload.col, BOARD_SIZE)) {
      return { ok: false, message: 'このスキルは角を封鎖できません。' };
    }
    const enemyColor = opponentOf(color);
    const legal = getLegalMovesFor(match, enemyColor, payload.targetLane).some(
      (move) => move.row === payload.row && move.col === payload.col,
    );
    return legal ? { ok: true } : { ok: false, message: '相手の合法手マスだけ封鎖できます。' };
  }

  if (payload.type === 'protect') {
    const lane = match.lanes[payload.targetLane];
    if (!lane || lane.ended) return { ok: false, message: '対象盤面を選べません。' };
    if (!lane.board[payload.row]?.[payload.col]) return { ok: false, message: '石があるマスだけ保護できます。' };
    if (hero.protectEdgesOnly && !isEdge(payload.row, payload.col, BOARD_SIZE)) {
      return { ok: false, message: 'このスキルは辺の石だけ保護できます。' };
    }
    return { ok: true };
  }

  if (payload.type === 'grantGauge') {
    if (payload.targetColor !== color) return { ok: false, message: '味方ヒーローだけ選べます。' };
    if (payload.targetLane === payload.sourceLane) return { ok: false, message: '自分以外の味方を選んでください。' };
    if (match.lanes[payload.targetLane]?.ended) return { ok: false, message: '終局済み盤面のヒーローは選べません。' };
    return { ok: true };
  }

  if (payload.type === 'drainGauge') {
    if (payload.targetColor !== opponentOf(color)) return { ok: false, message: '敵ヒーローだけ選べます。' };
    if (match.lanes[payload.targetLane]?.ended) return { ok: false, message: '終局済み盤面のヒーローは選べません。' };
    return { ok: true };
  }

  return { ok: false, message: '未対応のスキルです。' };
}

function executeSkill(match, color, hero, payload) {
  if (payload.type === 'block') {
    match.lanes[payload.targetLane].blockedCells.push({
      row: payload.row,
      col: payload.col,
      targetColor: opponentOf(color),
    });
  }

  if (payload.type === 'protect') {
    const cellColor = match.lanes[payload.targetLane].board[payload.row][payload.col];
    match.lanes[payload.targetLane].protectedCells.push({
      row: payload.row,
      col: payload.col,
      ownerColor: cellColor,
      createdByColor: color,
      expireAtColor: color,
      expireAtLane: payload.targetLane,
      expireAfterPlacement: cellColor !== color,
    });
  }

  if (payload.type === 'grantGauge') {
    const target = match.sides[color].heroes[payload.targetLane];
    target.gauge = Math.min(SKILL_MAX, target.gauge + 8);
  }

  if (payload.type === 'drainGauge') {
    const enemyColor = opponentOf(color);
    const target = match.sides[enemyColor].heroes[payload.targetLane];
    target.gauge = Math.max(0, target.gauge - 5);
  }
}

function clearExpiringEffectsAtTurnStart(match, color, lane) {
  const laneState = match.lanes[lane];
  laneState.protectedCells = laneState.protectedCells.filter(
    (cell) => cell.expireAfterPlacement || !(cell.expireAtColor === color && cell.expireAtLane === lane),
  );
}

function clearBlocksForTurn(match, color, lane) {
  const laneState = match.lanes[lane];
  laneState.blockedCells = laneState.blockedCells.filter((cell) => cell.targetColor !== color);
}

function removeOpponentProtectedCellsAfterPlacement(match, color, lane) {
  const laneState = match.lanes[lane];
  laneState.protectedCells = laneState.protectedCells.filter((cell) => {
    const protectedOpponentStone = cell.expireAfterPlacement && cell.createdByColor === color && cell.ownerColor === opponentOf(color);
    return !protectedOpponentStone;
  });
}

function finishAction(match) {
  resolveEndedLanes(match);
  resolveMatchWinner(match);
  if (match.status === 'playing') {
    advanceTurn(match);
    skipEndedLanes(match);
    clearExpiringEffectsAtTurnStart(match, match.activeColor, getActiveLane(match));
  }
}

function advanceTurn(match) {
  if (match.activeColor === COLORS.black) {
    match.activeColor = COLORS.white;
    return;
  }
  match.activeColor = COLORS.black;
  match.activeLaneIndex = (match.activeLaneIndex + 1) % LANES.length;
}

function skipEndedLanes(match) {
  let guard = 0;
  while (guard < LANES.length && match.lanes[getActiveLane(match)].ended) {
    match.activeLaneIndex = (match.activeLaneIndex + 1) % LANES.length;
    guard += 1;
  }
}

function resolveEndedLanes(match) {
  for (const lane of LANES) {
    const laneState = match.lanes[lane];
    if (laneState.ended) continue;

    const blackMoves = getLegalMovesFor(match, COLORS.black, lane);
    const whiteMoves = getLegalMovesFor(match, COLORS.white, lane);
    const blackSkills = getUsableSkills(match, COLORS.black).filter((skill) => canSkillAffectLane(match, COLORS.black, skill.hero, lane));
    const whiteSkills = getUsableSkills(match, COLORS.white).filter((skill) => canSkillAffectLane(match, COLORS.white, skill.hero, lane));

    if (blackMoves.length === 0 && whiteMoves.length === 0 && blackSkills.length === 0 && whiteSkills.length === 0) {
      laneState.ended = true;
      laneState.winner = boardWinner(laneState.board);
      laneState.protectedCells = [];
      laneState.blockedCells = [];
      match.log.unshift(`${labelForLane(lane)}終局: ${labelForWinner(laneState.winner)}`);
    }
  }
}

function canSkillAffectLane(match, color, hero, lane) {
  if (match.lanes[lane].ended) return false;
  if (hero.skillType === 'grantGauge') {
    return LANES.some((targetLane) => targetLane !== lane && !match.lanes[targetLane].ended);
  }
  if (hero.skillType === 'drainGauge') {
    return LANES.some((targetLane) => !match.lanes[targetLane].ended);
  }
  if (hero.skillType === 'protect') {
    return match.lanes[lane].board.some((row, rowIndex) =>
      row.some((cell, colIndex) => cell && (!hero.protectEdgesOnly || isEdge(rowIndex, colIndex, BOARD_SIZE))),
    );
  }
  if (hero.skillType === 'block') {
    const enemyColor = opponentOf(color);
    return getLegalMovesFor(match, enemyColor, lane).some(
      (move) => !hero.blockNoCorners || !isCorner(move.row, move.col, BOARD_SIZE),
    );
  }
  return false;
}

function resolveMatchWinner(match) {
  const laneWinners = LANES.map((lane) => match.lanes[lane].winner);
  const blackWins = laneWinners.filter((winner) => winner === COLORS.black).length;
  const whiteWins = laneWinners.filter((winner) => winner === COLORS.white).length;

  if (blackWins >= 2) {
    match.status = 'ended';
    match.winner = COLORS.black;
    match.resultReason = '2面先取';
    return;
  }
  if (whiteWins >= 2) {
    match.status = 'ended';
    match.winner = COLORS.white;
    match.resultReason = '2面先取';
    return;
  }

  const allEnded = LANES.every((lane) => match.lanes[lane].ended);
  if (!allEnded) return;

  const total = getTotalCounts(match);
  if (total.black > total.white) match.winner = COLORS.black;
  else if (total.white > total.black) match.winner = COLORS.white;
  else match.winner = 'draw';
  match.status = 'ended';
  match.resultReason = '総石数';
}

export function getTotalCounts(match) {
  return LANES.reduce(
    (total, lane) => {
      const counts = countDiscs(match.lanes[lane].board);
      total.black += counts.black;
      total.white += counts.white;
      total.empty += counts.empty;
      return total;
    },
    { black: 0, white: 0, empty: 0 },
  );
}

function labelForColor(color) {
  return color === COLORS.black ? '黒' : '白';
}

function labelForLane(lane) {
  return lane === 'left' ? '左面' : lane === 'center' ? '中央面' : '右面';
}

function labelForWinner(winner) {
  if (winner === COLORS.black) return '黒勝ち';
  if (winner === COLORS.white) return '白勝ち';
  return '引き分け';
}

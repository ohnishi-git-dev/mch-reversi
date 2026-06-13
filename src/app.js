import { COLORS, COLOR_LABELS, LANES, LANE_LABELS } from './core/constants.js';
import { coordKey, countDiscs, isCorner, isEdge } from './core/board.js';
import { chooseCpuAction } from './core/cpu.js';
import { HEROES, defaultPlayerHeroIds, getHero } from './core/heroes.js';
import {
  applyAutoPass,
  applyMove,
  applySkill,
  createMatch,
  getActiveLane,
  getCurrentOwner,
  getHeroFor,
  getLegalMovesFor,
  getTotalCounts,
  getUsableSkills,
  shouldAutoPass,
} from './core/match.js';

const app = document.querySelector('#app');

const state = {
  screen: 'setup',
  playerHeroIds: defaultPlayerHeroIds(),
  difficulty: 'normal',
  match: null,
  selectedSkill: null,
  message: 'ヒーローを選んで開始してください。',
  cpuThinking: false,
};

render();

function render() {
  if (state.screen === 'setup') {
    app.innerHTML = renderSetup();
    bindSetupEvents();
    return;
  }

  app.innerHTML = renderGame();
  bindGameEvents();
  centerActiveLane();
  processAutomaticTurns();
}

function renderSetup() {
  const slots = LANES.map((lane, index) => `
    <section class="setup-slot">
      <div class="slot-label">${LANE_LABELS[lane]}</div>
      <select data-hero-slot="${index}">
        ${HEROES.map((hero) => `
          <option value="${hero.id}" ${state.playerHeroIds[index] === hero.id ? 'selected' : ''}>${hero.name}</option>
        `).join('')}
      </select>
    </section>
  `).join('');

  return `
    <section class="setup-page">
      <div class="setup-header">
        <h1>MCH Reversi</h1>
        <p>3つの盤面を順番に進める、ヒーロースキル付きリバーシ。</p>
      </div>
      <div class="setup-grid">
        <section class="setup-panel">
          <h2>プレイヤー編成</h2>
          <div class="slot-grid">${slots}</div>
        </section>
        <section class="setup-panel">
          <h2>CPU</h2>
          <label class="field-label" for="difficulty">難易度</label>
          <select id="difficulty">
            ${['easy', 'normal', 'hard'].map((level) => `
              <option value="${level}" ${state.difficulty === level ? 'selected' : ''}>${level}</option>
            `).join('')}
          </select>
          <button class="primary-action" id="start-game">対局開始</button>
        </section>
      </div>
    </section>
  `;
}

function bindSetupEvents() {
  for (const select of app.querySelectorAll('[data-hero-slot]')) {
    select.addEventListener('change', (event) => {
      const index = Number(event.currentTarget.dataset.heroSlot);
      state.playerHeroIds[index] = event.currentTarget.value;
    });
  }

  app.querySelector('#difficulty').addEventListener('change', (event) => {
    state.difficulty = event.currentTarget.value;
  });

  app.querySelector('#start-game').addEventListener('click', () => {
    const playerColor = Math.random() < 0.5 ? COLORS.black : COLORS.white;
    const cpuHeroIds = LANES.map(() => randomItem(HEROES).id);
    state.match = createMatch({
      playerColor,
      playerHeroIds: state.playerHeroIds,
      cpuHeroIds,
      difficulty: state.difficulty,
    });
    state.screen = 'game';
    state.selectedSkill = null;
    state.message = `コイントス: プレイヤーは${COLOR_LABELS[playerColor]}です。`;
    render();
  });
}

function renderGame() {
  const match = state.match;
  const activeLane = getActiveLane(match);
  const currentOwner = getCurrentOwner(match);
  const currentIsPlayer = currentOwner === 'player';
  const legalMoves = currentIsPlayer ? getLegalMovesFor(match, match.activeColor, activeLane) : [];
  const legalMoveKeys = new Set(legalMoves.map((move) => coordKey(move.row, move.col)));
  const totals = getTotalCounts(match);

  return `
    <section class="game-shell">
      <header class="topbar">
        <div>
          <h1>MCH Reversi</h1>
          <p>${renderTurnLabel(match)}</p>
        </div>
        <div class="top-actions">
          <button class="secondary-action" id="new-game">新規対局</button>
        </div>
      </header>

      <section class="status-strip">
        <div class="status-card">
          <span>プレイヤー</span>
          <strong>${COLOR_LABELS[match.playerColor]}</strong>
        </div>
        <div class="status-card">
          <span>総石数</span>
          <strong>黒 ${totals.black} / 白 ${totals.white}</strong>
        </div>
        <div class="status-card">
          <span>状態</span>
          <strong>${match.status === 'ended' ? renderWinner(match) : state.message}</strong>
        </div>
      </section>

      <section class="hero-rows">
        ${renderHeroRow(match, COLORS.black)}
        ${renderHeroRow(match, COLORS.white)}
      </section>

      <section class="boards">
        ${LANES.map((lane) => renderLane(match, lane, legalMoveKeys)).join('')}
      </section>

      <section class="bottom-grid">
        <section class="action-panel">
          <h2>行動</h2>
          ${renderActionPanel(match)}
        </section>
        <section class="log-panel">
          <h2>ログ</h2>
          <ol>${match.log.slice(0, 8).map((entry) => `<li>${entry}</li>`).join('')}</ol>
        </section>
      </section>
    </section>
  `;
}

function renderTurnLabel(match) {
  if (match.status === 'ended') return renderWinner(match);
  const activeLane = getActiveLane(match);
  const owner = getCurrentOwner(match) === 'player' ? 'プレイヤー' : 'CPU';
  return `${owner} ${COLOR_LABELS[match.activeColor]} / ${LANE_LABELS[activeLane]}`;
}

function renderWinner(match) {
  if (match.winner === 'draw') return `引き分け (${match.resultReason})`;
  const owner = match.sides[match.winner].owner === 'player' ? 'プレイヤー' : 'CPU';
  return `${owner} ${COLOR_LABELS[match.winner]}勝利 (${match.resultReason})`;
}

function renderHeroRow(match, color) {
  const owner = match.sides[color].owner === 'player' ? 'プレイヤー' : 'CPU';
  return `
    <section class="hero-row ${match.activeColor === color ? 'current-side' : ''}">
      <div class="hero-row-label">${owner} ${COLOR_LABELS[color]}</div>
      <div class="hero-cards">
        ${LANES.map((lane) => renderHeroCard(match, color, lane)).join('')}
      </div>
    </section>
  `;
}

function renderHeroCard(match, color, lane) {
  const heroState = getHeroFor(match, color, lane);
  const ended = match.lanes[lane].ended;
  const canTargetHero = canSelectedSkillTargetHero(color, lane);
  const canUseSkill = getCurrentOwner(match) === 'player'
    && match.activeColor === color
    && !ended
    && heroState.gauge >= 10
    && match.status === 'playing';
  const selected = state.selectedSkill?.sourceLane === lane && state.selectedSkill?.color === color;

  return `
    <article
      class="hero-card ${ended ? 'ended' : ''} ${selected ? 'selected' : ''} ${canTargetHero ? 'targetable' : ''}"
      data-hero-target-color="${color}"
      data-hero-target-lane="${lane}"
      style="--hero-accent:${heroState.definition.accent}"
    >
      <div class="hero-avatar">${heroState.definition.shortName.slice(0, 2)}</div>
      <div class="hero-info">
        <strong>${heroState.definition.shortName}</strong>
        <span>${LANE_LABELS[lane]}</span>
      </div>
      <div class="gauge" aria-label="スキルゲージ">
        <span style="width:${heroState.gauge * 10}%"></span>
      </div>
      <button
        class="skill-button"
        data-skill-source="${lane}"
        ${canUseSkill ? '' : 'disabled'}
      >
        ${heroState.definition.skillName}
      </button>
    </article>
  `;
}

function renderLane(match, lane, legalMoveKeys) {
  const laneState = match.lanes[lane];
  const counts = countDiscs(laneState.board);
  const active = getActiveLane(match) === lane && match.status === 'playing';
  const protectedKeys = new Set(laneState.protectedCells.map((cell) => coordKey(cell.row, cell.col)));
  const blockedKeys = new Set(laneState.blockedCells.map((cell) => coordKey(cell.row, cell.col)));
  const blackOwner = match.sides.black.owner === 'player' ? 'YOU' : 'CPU';
  const whiteOwner = match.sides.white.owner === 'player' ? 'YOU' : 'CPU';
  const activeTurnText = active ? `${COLOR_LABELS[match.activeColor]}の手番` : (laneState.ended ? laneWinnerText(laneState.winner) : '待機');

  return `
    <section class="lane ${active ? 'active' : ''} ${laneState.ended ? 'ended' : ''}">
      <div class="tabletop">
        <div class="score-row score-row-top">
          <span class="player-badge cpu-badge">${blackOwner}</span>
          <span class="score-badge">黒 ${String(counts.black).padStart(2, '0')}</span>
        </div>
        <div class="disc-rack top-rack" aria-hidden="true"></div>
        <header class="lane-header">
          <div>
            <h2>${LANE_LABELS[lane]}</h2>
            <span>黒 ${counts.black} / 白 ${counts.white}</span>
          </div>
          <strong>${laneState.ended ? laneWinnerText(laneState.winner) : active ? '進行中' : '待機'}</strong>
        </header>
        <div class="board-frame">
          <div class="board" data-lane="${lane}">
            ${laneState.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const key = coordKey(rowIndex, colIndex);
                const legal = active && legalMoveKeys.has(key) && !state.selectedSkill;
                const skillTarget = canSelectedSkillTargetCell(lane, rowIndex, colIndex);
                return `
                  <button
                    class="cell ${cell ? `disc-${cell}` : ''} ${legal ? 'legal' : ''} ${skillTarget ? 'skill-target' : ''} ${protectedKeys.has(key) ? 'protected' : ''} ${blockedKeys.has(key) ? 'blocked' : ''}"
                    data-lane="${lane}"
                    data-row="${rowIndex}"
                    data-col="${colIndex}"
                    ${match.status === 'ended' ? 'disabled' : ''}
                  >
                    ${cell ? '<span class="disc"></span>' : ''}
                  </button>
                `;
              }).join('')
            ).join('')}
          </div>
        </div>
        <div class="turn-plaque">${activeTurnText}</div>
        <div class="disc-rack bottom-rack" aria-hidden="true"></div>
        <div class="score-row score-row-bottom">
          <span class="score-badge">白 ${String(counts.white).padStart(2, '0')}</span>
          <span class="player-badge you-badge">${whiteOwner}</span>
        </div>
      </div>
    </section>
  `;
}

function renderActionPanel(match) {
  if (match.status === 'ended') {
    return `<p class="panel-message">${renderWinner(match)}</p>`;
  }

  if (getCurrentOwner(match) !== 'player') {
    return `<p class="panel-message">CPU が考えています。</p>`;
  }

  const activeLane = getActiveLane(match);
  const legalMoves = getLegalMovesFor(match, match.activeColor, activeLane);
  const usableSkills = getUsableSkills(match, match.activeColor);

  if (state.selectedSkill) {
    const hero = getHero(state.selectedSkill.heroId);
    return `
      <div class="selected-skill">
        <strong>${hero.skillName}</strong>
        <p>${hero.description}</p>
        <button class="secondary-action" id="cancel-skill">キャンセル</button>
      </div>
    `;
  }

  return `
    <p class="panel-message">
      ${legalMoves.length > 0 ? '合法手を選択するか、満タンのスキルを使えます。' : '合法手がありません。使用可能なスキルがなければ自動パスします。'}
    </p>
    <div class="usable-skills">
      ${usableSkills.length === 0 ? '<span>使用可能なスキルなし</span>' : usableSkills.map((skill) => `
        <button class="skill-choice" data-skill-source="${skill.lane}">
          ${LANE_LABELS[skill.lane]} / ${skill.hero.skillName}
        </button>
      `).join('')}
    </div>
  `;
}

function bindGameEvents() {
  app.querySelector('#new-game').addEventListener('click', () => {
    state.screen = 'setup';
    state.match = null;
    state.selectedSkill = null;
    state.message = 'ヒーローを選んで開始してください。';
    render();
  });

  for (const button of app.querySelectorAll('[data-skill-source]')) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      selectSkill(event.currentTarget.dataset.skillSource);
    });
  }

  const cancel = app.querySelector('#cancel-skill');
  if (cancel) {
    cancel.addEventListener('click', () => {
      state.selectedSkill = null;
      state.message = 'スキル選択を解除しました。';
      render();
    });
  }

  for (const cell of app.querySelectorAll('.cell')) {
    cell.addEventListener('click', () => {
      const lane = cell.dataset.lane;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      handleCellClick(lane, row, col);
    });
  }

  for (const card of app.querySelectorAll('[data-hero-target-color]')) {
    card.addEventListener('click', () => {
      handleHeroTargetClick(card.dataset.heroTargetColor, card.dataset.heroTargetLane);
    });
  }
}

function centerActiveLane() {
  requestAnimationFrame(() => {
    const boards = app.querySelector('.boards');
    const activeLane = app.querySelector('.lane.active');
    if (!boards || !activeLane) return;
    const target = activeLane.offsetLeft - (boards.clientWidth - activeLane.offsetWidth) / 2;
    boards.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  });
}

function selectSkill(sourceLane) {
  const match = state.match;
  if (getCurrentOwner(match) !== 'player') return;
  const heroState = getHeroFor(match, match.activeColor, sourceLane);
  if (heroState.gauge < 10 || match.lanes[sourceLane].ended) return;
  state.selectedSkill = {
    color: match.activeColor,
    sourceLane,
    heroId: heroState.heroId,
    type: heroState.definition.skillType,
  };
  state.message = `${heroState.definition.skillName}: 対象を選んでください。`;
  render();
}

function handleCellClick(lane, row, col) {
  const match = state.match;
  if (match.status !== 'playing' || getCurrentOwner(match) !== 'player') return;

  if (state.selectedSkill) {
    const hero = getHero(state.selectedSkill.heroId);
    if (hero.skillType !== 'block' && hero.skillType !== 'protect') return;
    const result = applySkill(match, state.selectedSkill.sourceLane, {
      type: hero.skillType,
      sourceLane: state.selectedSkill.sourceLane,
      targetLane: lane,
      row,
      col,
    });
    commitResult(result);
    return;
  }

  if (lane !== getActiveLane(match)) {
    state.message = '現在の盤面にだけ配置できます。';
    render();
    return;
  }

  commitResult(applyMove(match, row, col));
}

function handleHeroTargetClick(color, lane) {
  const match = state.match;
  if (!state.selectedSkill || match.status !== 'playing' || getCurrentOwner(match) !== 'player') return;
  const hero = getHero(state.selectedSkill.heroId);
  if (hero.skillType !== 'grantGauge' && hero.skillType !== 'drainGauge') return;

  commitResult(applySkill(match, state.selectedSkill.sourceLane, {
    type: hero.skillType,
    sourceLane: state.selectedSkill.sourceLane,
    targetColor: color,
    targetLane: lane,
  }));
}

function commitResult(result) {
  state.match = result.match;
  state.selectedSkill = null;
  state.message = result.ok ? '行動しました。' : result.message;
  render();
}

function canSelectedSkillTargetCell(lane, row, col) {
  if (!state.selectedSkill || getCurrentOwner(state.match) !== 'player') return false;
  const hero = getHero(state.selectedSkill.heroId);

  if (hero.skillType === 'block') {
    if (state.match.lanes[lane].ended) return false;
    if (hero.blockNoCorners && isCorner(row, col)) return false;
    return getLegalMovesFor(state.match, opponentOf(state.match.activeColor), lane)
      .some((move) => move.row === row && move.col === col);
  }

  if (hero.skillType === 'protect') {
    if (state.match.lanes[lane].ended) return false;
    if (!state.match.lanes[lane].board[row][col]) return false;
    if (hero.protectEdgesOnly && !isEdge(row, col)) return false;
    return true;
  }

  return false;
}

function canSelectedSkillTargetHero(color, lane) {
  if (!state.selectedSkill || getCurrentOwner(state.match) !== 'player') return false;
  if (state.match.lanes[lane].ended) return false;
  const hero = getHero(state.selectedSkill.heroId);
  if (hero.skillType === 'grantGauge') {
    return color === state.match.activeColor && lane !== state.selectedSkill.sourceLane;
  }
  if (hero.skillType === 'drainGauge') {
    return color !== state.match.activeColor;
  }
  return false;
}

function processAutomaticTurns() {
  const match = state.match;
  if (!match || match.status !== 'playing' || state.cpuThinking) return;

  if (getCurrentOwner(match) === 'player' && shouldAutoPass(match)) {
    const result = applyAutoPass(match);
    state.match = result.match;
    state.message = '合法手も使用可能なスキルもないため、自動パスしました。';
    setTimeout(render, 100);
    return;
  }

  if (getCurrentOwner(match) === 'cpu') {
    state.cpuThinking = true;
    setTimeout(() => {
      const action = chooseCpuAction(state.match);
      let result;
      if (action.kind === 'move') {
        result = applyMove(state.match, action.move.row, action.move.col);
      } else if (action.kind === 'skill') {
        result = applySkill(state.match, action.sourceLane, action.payload);
      } else {
        result = applyAutoPass(state.match);
      }
      state.match = result.match;
      state.cpuThinking = false;
      state.message = action.kind === 'move' ? 'CPU が石を置きました。' : action.kind === 'skill' ? 'CPU がスキルを使いました。' : 'CPU がパスしました。';
      render();
    }, 450);
  }
}

function laneWinnerText(winner) {
  if (winner === COLORS.black) return '黒勝ち';
  if (winner === COLORS.white) return '白勝ち';
  return '引き分け';
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function opponentOf(color) {
  return color === COLORS.black ? COLORS.white : COLORS.black;
}

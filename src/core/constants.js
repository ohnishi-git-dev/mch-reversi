export const BOARD_SIZE = 6;
export const LANES = ['left', 'center', 'right'];
export const LANE_LABELS = {
  left: '左面',
  center: '中央面',
  right: '右面',
};

export const COLORS = {
  black: 'black',
  white: 'white',
};

export const COLOR_LABELS = {
  black: '黒',
  white: '白',
};

export const SKILL_MAX = 10;
export const SKILL_COST = 10;

export const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function opponentOf(color) {
  return color === COLORS.black ? COLORS.white : COLORS.black;
}

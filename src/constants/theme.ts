export const DARK_THEME = {
  bg:           '#0f0f1a',
  surface:      '#1a1a2e',
  cell:         '#16213e',
  cellHint:     '#1e3a5f',
  wall:         '#c0392b',
  exit:         '#27ae60',
  exitGlow:     '#2ecc71',
  player:       '#00d4ff',
  playerGlow:   '#0099bb',
  text:         '#e0e0e0',
  subText:      '#888',
  dpad:         '#2a2a3e',
  dpadActive:   '#3a3a5e',
  border:       '#333',
  hintArrow:    '#5599ff',
};

export const LIGHT_THEME = {
  bg:           '#f0f4f8',
  surface:      '#ffffff',
  cell:         '#e8edf2',
  cellHint:     '#b8d4f0',
  wall:         '#e74c3c',
  exit:         '#2ecc71',
  exitGlow:     '#27ae60',
  player:       '#0077aa',
  playerGlow:   '#005588',
  text:         '#1a1a2e',
  subText:      '#666',
  dpad:         '#dde3ea',
  dpadActive:   '#c5cfd8',
  border:       '#ccc',
  hintArrow:    '#2266cc',
};

export type Theme = typeof DARK_THEME;

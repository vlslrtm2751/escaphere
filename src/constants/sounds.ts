export const SFX = {
  move:     'move.wav',
  wall:     'wall.wav',
  gameover: 'gameover.wav',
  clear:    'clear.wav',
  hint:     'hint.wav',
  undo:     'undo.wav',
} as const;

export type SfxKey = keyof typeof SFX;

import { Difficulty, Direction, Face, WallPair, Position } from "../types/game";

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    gridSize: number;
    /**
     * Total walled cells to aim for — the solution path AND its decoy branches.
     * The path alone costs minSolutionLength - 1, so the budget has to clear
     * that comfortably or there is no room left to build anything to choose
     * between.
     */
    minWalls: number;
    maxWalls: number;
    undoLimit: number;
    minSolutionLength: number;
    /**
     * Moves that must be available from the spawn. Below this the board reads as
     * "there is only one way to go" and solves itself. 7x7 has too little room
     * to guarantee three, so easy asks for two.
     */
    minStartOptions: number;
  }
> = {
  easy: {
    gridSize: 7,
    minWalls: 12,
    maxWalls: 20,
    undoLimit: 5,
    minSolutionLength: 7,
    minStartOptions: 2,
  },
  normal: {
    gridSize: 9,
    minWalls: 20,
    maxWalls: 32,
    undoLimit: 3,
    minSolutionLength: 10,
    minStartOptions: 3,
  },
  hard: {
    gridSize: 11,
    minWalls: 32,
    maxWalls: 48,
    undoLimit: 1,
    minSolutionLength: 15,
    minStartOptions: 3,
  },
  hardcore: {
    gridSize: 13,
    minWalls: 46,
    maxWalls: 66,
    undoLimit: 1,
    minSolutionLength: 22,
    minStartOptions: 3,
  },
};

export const DIRECTION_TO_FACE: Record<Direction, Face> = {
  up: "top",
  down: "bottom",
  left: "left",
  right: "right",
};

export const OPPOSITE_FACE: Record<Face, Face> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const DIR_DELTA: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export const WALL_PAIR_FACES: Record<WallPair, [Face, Face]> = {
  "top-right": ["top", "right"],
  "right-bottom": ["right", "bottom"],
  "bottom-left": ["bottom", "left"],
  "left-top": ["left", "top"],
};

// 0 wall, 1 dot, 2 power pellet, 3 empty
export const MAZE: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,2,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,2,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,0,0,1,0,0,0,1,0,3,0,1,0,0,0,1,0,0,0],
  [3,1,1,1,0,1,1,1,1,3,1,1,1,1,0,1,1,1,3],
  [0,0,0,1,0,1,0,3,3,3,3,3,0,1,0,1,0,0,0],
  [3,1,1,1,1,1,0,3,3,3,3,3,0,1,1,1,1,1,3],
  [0,0,0,1,0,1,0,3,3,3,3,3,0,1,0,1,0,0,0],
  [3,1,1,1,0,1,1,1,1,3,1,1,1,1,0,1,1,1,3],
  [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,2,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,2,0],
  [0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export const TILE = 24;
export const COLS = MAZE[0].length;
export const ROWS = MAZE.length;

export type Dir = "up" | "down" | "left" | "right";
export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const GHOST_COLORS = ["#ff4d4d", "#ffb8ff", "#4dffff", "#ffb84d"];
export const GHOST_STARTS: { x: number; y: number }[] = [
  { x: 9, y: 8 },
  { x: 5, y: 11 },
  { x: 9, y: 11 },
  { x: 13, y: 11 },
];

export const START = { x: 9, y: 3 };

export function tileAt(c: number, r: number): number {
  if (r < 0 || r >= ROWS) return 0;
  const cc = (c + COLS) % COLS;
  return MAZE[r][cc];
}

export function isWall(c: number, r: number): boolean {
  return tileAt(c, r) === 0;
}

export function canMove(c: number, r: number, dir: Dir): boolean {
  const [dx, dy] = DIRS[dir];
  return !isWall(c + dx, r + dy);
}

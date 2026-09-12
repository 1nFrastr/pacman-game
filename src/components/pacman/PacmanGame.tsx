"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLS, DIRS, GHOST_COLORS, GHOST_STARTS, MAZE, ROWS, START, TILE,
  canMove, isWall, tileAt, type Dir,
} from "./constants";

type Pos = { x: number; y: number };
type Ghost = Pos & { dir: Dir; frightened: boolean };

const SPEED = 170; // ms per tile
const GHOST_SPEED = 260;

function opposite(d: Dir): Dir {
  return d === "up" ? "down" : d === "down" ? "up" : d === "left" ? "right" : "left";
}

function drawMaze(ctx: CanvasRenderingContext2D, dots: number[][], power: number[][]) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isWall(c, r)) {
        ctx.fillStyle = "#1e3a8a";
        ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
      } else if (dots[r]?.[c]) {
        ctx.fillStyle = "#ffd27f";
        ctx.beginPath();
        ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (power[r]?.[c]) {
        ctx.fillStyle = "#fff";
        const pulse = 4 + Math.sin(Date.now() / 200) * 1.5;
        ctx.beginPath();
        ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPac(ctx: CanvasRenderingContext2D, p: Pos, dir: Dir, t: number) {
  const angleMap: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
  const cx = p.x * TILE + TILE / 2, cy = p.y * TILE + TILE / 2;
  const open = Math.abs(Math.sin(t / 120)) * 0.8;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleMap[dir]);
  ctx.fillStyle = "#ffe600";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, TILE / 2 - 2, open * Math.PI, (2 - open) * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, i: number) {
  const cx = g.x * TILE + TILE / 2, cy = g.y * TILE + TILE / 2, r = TILE / 2 - 2;
  ctx.fillStyle = g.frightened ? "#2b5cff" : GHOST_COLORS[i];
  ctx.beginPath();
  ctx.arc(cx, cy - 2, r, Math.PI, 0);
  ctx.lineTo(cx + r, cy + r - 2);
  for (let k = 0; k < 3; k++) {
    ctx.lineTo(cx + r - (k * 2 + 1) * (r / 3), cy + r - 2 - (k % 2 ? 4 : 0));
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 4, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 3, cy - 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (!g.frightened) {
    ctx.fillStyle = "#00f";
    ctx.fillRect(cx - 4, cy - 5, 2, 2);
    ctx.fillRect(cx + 2, cy - 5, 2, 2);
  }
}

export default function PacmanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"ready" | "playing" | "over" | "win">("ready");
  const [lives, setLives] = useState(10);

  const state = useRef({
    dots: MAZE.map((row) => row.map((v) => (v === 1 ? 1 : 0))),
    power: MAZE.map((row) => row.map((v) => (v === 2 ? 1 : 0))),
    pac: { ...START },
    dir: "left" as Dir,
    nextDir: "left" as Dir,
    ghosts: GHOST_STARTS.map((s, i) => ({
      ...s,
      dir: (["up", "left", "down", "right"] as Dir[])[i],
      frightened: false,
    })),
    frightTimer: 0,
    grace: 2200,
    anim: 0,
    status: "ready" as typeof status,
  });

  const reset = useCallback((full: boolean) => {
    const s = state.current;
    s.pac = { ...START };
    s.dir = "left";
    s.nextDir = "left";
    s.ghosts = GHOST_STARTS.map((g, i) => ({ ...g, dir: (["up", "left", "down", "right"] as Dir[])[i], frightened: false }));
    s.frightTimer = 0;
    if (full) {
      s.dots = MAZE.map((row) => row.map((v) => (v === 1 ? 1 : 0)));
      s.power = MAZE.map((row) => row.map((v) => (v === 2 ? 1 : 0)));
      setScore(0);
      livesRef.current = 10;
      setLives(10);
    }
  }, []);

  const start = useCallback(() => {
    reset(true);
    state.current.status = "playing";
    setStatus("playing");
  }, [reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        state.current.nextDir = dir;
        if (state.current.status === "ready") {
          state.current.status = "playing";
          setStatus("playing");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let lastPac = 0, lastGhost = 0, raf = 0;

    const move = (p: Pos, dir: Dir) => {
      const [dx, dy] = DIRS[dir];
      p.x = (p.x + dx + COLS) % COLS;
      p.y += dy;
    };

    const stepPac = () => {
      const s = state.current;
      if (canMove(s.pac.x, s.pac.y, s.nextDir)) s.dir = s.nextDir;
      if (canMove(s.pac.x, s.pac.y, s.dir)) move(s.pac, s.dir);
      if (s.dots[s.pac.y]?.[s.pac.x]) {
        s.dots[s.pac.y][s.pac.x] = 0;
        setScore((v) => v + 10);
      }
      if (s.power[s.pac.y]?.[s.pac.x]) {
        s.power[s.pac.y][s.pac.x] = 0;
        setScore((v) => v + 50);
        s.frightTimer = 6000;
        s.ghosts.forEach((g) => { g.frightened = true; g.dir = opposite(g.dir); });
      }
      if (s.dots.flat().every((d) => !d) && s.power.flat().every((d) => !d)) {
        s.status = "win";
        setStatus("win");
      }
    };

    const stepGhost = (g: Ghost, idx: number) => {
      const s = state.current;
      const options: Dir[] = ["up", "left", "down", "right"].filter(
        (d) => !isWall(g.x + DIRS[d][0], g.y + DIRS[d][1]) && d !== opposite(g.dir)
      );
      if (options.length === 0) {
        const back = opposite(g.dir);
        if (!isWall(g.x + DIRS[back][0], g.y + DIRS[back][1])) options.push(back);
      }
      let chosen: Dir;
      if (g.frightened) {
        chosen = options[Math.floor(Math.random() * options.length)];
      } else if (idx === 0 && Math.random() < 0.4) {
        // chase: minimize distance to pac
        options.sort((a, b) => {
          const d = (dir: Dir) =>
            Math.abs(g.x + DIRS[dir][0] - s.pac.x) + Math.abs(g.y + DIRS[dir][1] - s.pac.y);
          return d(a) - d(b);
        });
        chosen = options[0];
      } else {
        chosen = options[Math.floor(Math.random() * options.length)];
      }
      if (chosen) {
        g.dir = chosen;
        move(g, chosen);
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const s = state.current;
      if (s.status !== "playing") {
        // idle render
      } else {
        if (s.frightTimer > 0) {
          s.frightTimer -= 16;
          if (s.frightTimer <= 0) s.ghosts.forEach((g) => (g.frightened = false));
        }
        if (s.grace > 0) s.grace -= 16;
        if (t - lastPac >= SPEED) { lastPac = t; stepPac(); }
        if (t - lastGhost >= GHOST_SPEED) {
          lastGhost = t;
          s.ghosts.forEach((g, i) => stepGhost(g, i));
        }
        // collisions
        for (const g of s.ghosts) {
          if (s.grace <= 0 && g.x === s.pac.x && g.y === s.pac.y) {
            if (g.frightened) {
              g.x = GHOST_STARTS[s.ghosts.indexOf(g)].x;
              g.y = GHOST_STARTS[s.ghosts.indexOf(g)].y;
              setScore((v) => v + 200);
            } else {
              livesRef.current -= 1;
              setLives(livesRef.current);
              if (livesRef.current <= 0) {
                s.status = "over";
                setStatus("over");
              } else {
                reset(false);
              }
            }
            break;
          }
        }
      }
      s.anim = t;

      // render
      const w = COLS * TILE, h = ROWS * TILE;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawMaze(ctx, s.dots, s.power);
      drawPac(ctx, s.pac, s.dir, t);
      s.ghosts.forEach((g, i) => {
        if (s.grace > 0) {
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t / 80);
        }
        drawGhost(ctx, g, i);
        ctx.globalAlpha = 1;
      });
      if (s.status === "over" || s.status === "win") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, h / 2 - 30, w, 60);
        ctx.fillStyle = s.status === "win" ? "#ffe600" : "#ff4d4d";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.status === "win" ? "YOU WIN!" : "GAME OVER", w / 2, h / 2 + 10);
      }
      if (s.status === "ready") {
        ctx.fillStyle = "#ffe600";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("按方向键开始", w / 2, h / 2);
      }
      void tileAt;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reset]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center gap-8 text-lg font-semibold text-foreground">
        <span>得分 <span className="text-yellow-400">{score}</span></span>
        <span>生命 {"❤️".repeat(Math.max(lives, 0))}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={COLS * TILE}
        height={ROWS * TILE}
        className="rounded-lg border border-blue-900/50 bg-black touch-none"
      />
      <div className="flex gap-3">
        {status === "playing" ? (
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            onClick={() => { state.current.status = "ready"; setStatus("ready"); }}
          >
            暂停
          </button>
        ) : (
          <button
            className="rounded bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400"
            onClick={start}
          >
            {status === "over" || status === "win" ? "重新开始" : "开始游戏"}
          </button>
        )}
      </div>
      <p className="text-sm text-foreground/70">方向键 / WASD 控制 · 吃光豆子获胜 · 大力丸可反杀幽灵</p>
    </div>
  );
}

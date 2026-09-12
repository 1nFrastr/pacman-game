"use client";

import { useEffect, useRef, useState } from "react";
import kaplay from "kaplay";
import { COLS, DIRS, GHOST_COLORS, GHOST_STARTS, MAZE, ROWS, START, TILE } from "../constants";
import { attachGhostDraw, attachPacDraw } from "./draw";

type Vec2 = { x: number; y: number };

const PAC_SPEED = TILE / 170; // px/ms，与旧版一致
const GHOST_SPEED = TILE / 260;
const FRIGHT_MS = 6000;
const GRACE_MS = 2200;

const isWall = (x: number, y: number) =>
  x < 0 || x >= COLS || y < 0 || y >= ROWS || MAZE[y][x] === 1;

export type Hud = { score: number; lives: number; status: "ready" | "playing" | "over" | "win" };

export default function KaplayPacman() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 10, status: "ready" });
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!canvasRef.current) return;
    const k = kaplay({
      canvas: canvasRef.current,
      width: COLS * TILE,
      height: ROWS * TILE,
      background: [0, 0, 0],
      crisp: true,
      global: false,
    });

    const wallCol = k.rgb(30, 60, 200);
    let score = 0, lives = 10, status: Hud["status"] = "ready";
    let dots = new Set<string>(), power = new Set<string>();
    let frightTimer = 0, grace = 0;
    let pac: any, ghosts: any[] = [];
    const hudPush = () => setHud({ score, lives, status });

    // ---- 场景搭建 ----
    const buildLevel = () => {
      k.destroyAll("wall"); k.destroyAll("dot"); k.destroyAll("power");
      dots = new Set(); power = new Set();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = MAZE[y][x];
          const p = k.vec2(x * TILE + TILE / 2, y * TILE + TILE / 2);
          if (v === 1) {
            k.add([k.pos(p), k.rect(TILE - 1, TILE - 1), k.color(30, 60, 200), k.anchor("center"), "wall"]);
          } else if (v === 3) {
            // 幽灵房区域：空地
          } else if (v === 2) {
            power.add(`${x},${y}`);
            k.add([k.pos(p), k.circle(4.5), k.color(255, 210, 130), k.anchor("center"), "power", { gx: x, gy: y }]);
          } else {
            dots.add(`${x},${y}`);
            k.add([k.pos(p), k.circle(2.2), k.color(255, 210, 130), k.anchor("center"), "dot", { gx: x, gy: y }]);
          }
        }
      }
    };
    void wallCol;
    void buildLevel;
    // ---- 实体 ----
    const spawnPac = () => {
      pac = k.add([
        k.pos(cx(START.x), cy(START.y)),
        k.anchor("center"),
        "pac",
        { tile: { ...START }, dir: "left", want: "left", prog: 0 },
      ]);
      attachPacDraw(pac, k);
    };

    const spawnGhosts = () => {
      ghosts = GHOST_STARTS.map((g, i) => {
        const gh = k.add([
          k.pos(cx(g.x), cy(g.y)),
          k.anchor("center"),
          "ghost",
          { tile: { ...g }, dir: DIRS[i].dir, gd: { color: GHOST_COLORS[i], frightened: false }, },
        ]);
        attachGhostDraw(gh, k, graceRef);
        return gh;
      });
    };
    const graceRef = { v: 0 };

    function cx(x: number) { return x * TILE + TILE / 2; }
    function cy(y: number) { return y * TILE + TILE / 2; }

    const resetRound = (full: boolean) => {
      if (full) { score = 0; lives = 10; buildLevel(); }
      k.destroyAll("pac"); k.destroyAll("ghost");
      spawnPac(); spawnGhosts();
      frightTimer = 0; grace = GRACE_MS;
      status = full ? "ready" : "playing";
      hudPush();
    };
    restartRef.current = () => resetRound(true);
    resetRound(true);

    // ---- 移动 ----
    const keyDirs: Record<string, Vec2> = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    const opp = (d: string) => ({ up: "down", down: "up", left: "right", right: "left" }[d]!);

    k.onKeyDown(["up", "w"], () => tryTurn("up"));
    k.onKeyDown(["down", "s"], () => tryTurn("down"));
    k.onKeyDown(["left", "a"], () => tryTurn("left"));
    k.onKeyDown(["right", "d"], () => tryTurn("right"));
    k.onKeyPress(["space"], () => { if (status === "ready") { status = "playing"; hudPush(); } });

    function tryTurn(d: string) {
      if (status === "ready") { status = "playing"; hudPush(); }
      if (status !== "playing") return;
      pac.want = d;
      if (pac.dir === opp(d)) pac.dir = d; // 掉头即时生效
    }

    function stepEnt(e: any, speed: number, choose: (e: any) => string | null) {
      const dtMs = k.dt() * 1000;
      let budget = speed * dtMs;
      while (budget > 0) {
        const target = { x: cx(e.tile.x), y: cy(e.tile.y) };
        const d = keyDirs[e.dir];
        const nx = e.tile.x + d.x, ny = e.tile.y + d.y;
        const canFwd = !isWall(nx, ny);
        const atCenter = Math.abs(e.pos.x - target.x) < 0.5 && Math.abs(e.pos.y - target.y) < 0.5;
        if (atCenter) {
          const nd = choose(e);
          if (nd && nd !== e.dir) e.dir = nd;
          if (!canFwd && !nd) { budget = 0; break; } // 撞墙停
          if (!canFwd && nd === e.dir) { budget = 0; break; }
        }
        const move = Math.min(budget, TILE - e.prog);
        const step = Math.min(move, TILE);
        e.prog += move;
        e.pos.x += d.x * move;
        e.pos.y += d.y * move;
        budget -= move;
        if (e.prog >= TILE - 0.01) {
          // 到达下一格中心
          e.tile = { x: nx, y: ny };
          e.pos.x = cx(nx); e.pos.y = cy(ny);
          e.prog = 0;
        }
      }
    }
    void stepEnt;

    // ---- 幽灵 AI ----
    function chooseGhost(g: any) {
      const opts = (["up", "left", "down", "right"] as const).filter((d) => {
        const dd = keyDirs[d];
        return !isWall(g.tile.x + dd.x, g.tile.y + dd.y) && d !== opp(g.dir);
      });
      if (opts.length === 0) return opp(g.dir);
      // 隧道环绕
      const toPac = { x: pac.tile.x - g.tile.x, y: pac.tile.y - g.tile.y };
      const chase = Math.random() < 0.4;
      if (chase && !g.gd.frightened) {
        opts.sort((a, b) => {
          const da = keyDirs[a], db = keyDirs[b];
          const la = (toPac.x - da.x) ** 2 + (toPac.y - da.y) ** 2;
          const lb = (toPac.x - db.x) ** 2 + (toPac.y - db.y) ** 2;
          return la - lb;
        });
        return opts[0];
      }
      return opts[Math.floor(Math.random() * opts.length)];
    }

    // ---- 主循环 ----
    k.onUpdate(() => {
      if (status !== "playing") return;
      if (grace > 0) grace -= k.dt() * 1000;
      graceRef.v = grace;
      if (frightTimer > 0) {
        frightTimer -= k.dt() * 1000;
        if (frightTimer <= 0) ghosts.forEach((g) => (g.gd.frightened = false));
      }
      if (grace <= 0) k.destroyAll("blink");
      stepEnt(pac, PAC_SPEED, () => {
        const d = keyDirs[pac.want];
        if (!isWall(pac.tile.x + d.x, pac.tile.y + d.y)) return pac.want;
        const dd = keyDirs[pac.dir];
        if (!isWall(pac.tile.x + dd.x, pac.tile.y + dd.y)) return pac.dir;
        return null;
      });
      ghosts.forEach((g) => stepEnt(g, g.gd.frightened ? GHOST_SPEED * 0.8 : GHOST_SPEED, chooseGhost));
      wrapTunnel(pac); ghosts.forEach(wrapTunnel);
      eatCheck();
      ghostCollide();
    });

    function wrapTunnel(e: any) {
      const half = TILE / 2;
      if (e.pos.x < -half) { e.pos.x = COLS * TILE + half; e.tile.x = COLS - 1; }
      if (e.pos.x > COLS * TILE + half) { e.pos.x = -half; e.tile.x = 0; }
    }

    function eatCheck() {
      const key = `${pac.tile.x},${pac.tile.y}`;
      if (dots.has(key)) {
        dots.delete(key);
        k.get("dot").find((o: any) => o.gx === pac.tile.x && o.gy === pac.tile.y)?.destroy();
        score += 10; hudPush();
      } else if (power.has(key)) {
        power.delete(key);
        k.get("power").find((o: any) => o.gx === pac.tile.x && o.gy === pac.tile.y)?.destroy();
        score += 50; hudPush();
        frightTimer = FRIGHT_MS;
        ghosts.forEach((g) => { g.gd.frightened = true; });
      }
      if (dots.size === 0 && power.size === 0) { status = "win"; hudPush(); }
    }

    function ghostCollide() {
      if (grace > 0) return;
      for (const g of ghosts) {
        const dist = Math.hypot(g.pos.x - pac.pos.x, g.pos.y - pac.pos.y);
        if (dist > TILE * 0.65) continue;
        if (g.gd.frightened) {
          const home = GHOST_STARTS[ghosts.indexOf(g)];
          g.tile = { ...home }; g.pos.x = cx(home.x); g.pos.y = cy(home.y);
          g.gd.frightened = false;
          score += 200; hudPush();
        } else {
          lives -= 1; hudPush();
          if (lives <= 0) { status = "over"; hudPush(); }
          else resetRound(false);
          return;
        }
      }
    }

    // ---- 覆盖文字 ----
    k.onDraw(() => {
      if (status === "ready") k.drawText({ text: "按方向键开始", size: 18, pos: k.vec2(k.width() / 2 - 62, k.height() / 2 - 9), color: k.rgb(255, 255, 0) });
      if (status === "over") k.drawText({ text: "GAME OVER", size: 26, pos: k.vec2(k.width() / 2 - 88, k.height() / 2 - 13), color: k.rgb(255, 60, 60) });
      if (status === "win") k.drawText({ text: "YOU WIN!", size: 26, pos: k.vec2(k.width() / 2 - 70, k.height() / 2 - 13), color: k.rgb(255, 255, 0) });
    });

    return () => k.quit();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <h1 className="text-2xl font-bold tracking-widest text-yellow-300">PAC-MAN</h1>
      <div className="flex gap-8 text-sm text-foreground/80">
        <span>分数 {hud.score}</span>
        <span>生命 {"❤️".repeat(Math.max(hud.lives, 0))}</span>
        <span>
          {hud.status === "win" ? "🏆 胜利!" : hud.status === "over" ? "💀 游戏结束" : "方向键 / WASD 移动"}
        </span>
      </div>
      <canvas ref={canvasRef} className="rounded-lg border border-foreground/10" />
      <div className="flex gap-3">
        <button
          onClick={() => restartRef.current()}
          className="rounded-md bg-yellow-300 px-4 py-1.5 text-sm font-semibold text-black hover:bg-yellow-200"
        >
          重新开始
        </button>
      </div>
      <p className="text-xs text-foreground/50">吃光所有豆子获胜 · 大力丸可反杀幽灵 +200 · Powered by Kaplay</p>
    </div>
  );
}

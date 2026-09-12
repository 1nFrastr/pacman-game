import type { GameObj } from "kaplay";

// Kaplay 自定义绘制：吃豆人与幽灵的矢量外观
type Ctx = { drawCircle: Function; drawRect: Function; drawTriangle: Function; vec2: Function; rgb: Function; time: Function };

const YELLOW = (rgb: Function) => rgb(255, 220, 40);
const BLUE = (rgb: Function) => rgb(40, 40, 220);

export function attachPacDraw(obj: GameObj, k: Ctx) {
  obj.onDraw(() => {
    const t = k.time() * 10;
    const open = (Math.sin(t) + 1) * 0.28; // 0~0.56
    const r = 9;
    k.drawCircle({ pos: k.vec2(0, 0), radius: r, color: YELLOW(k.rgb) });
    // 嘴巴（用背景色三角形挖出）
    const ang = mouthAngle(obj.dir);
    const a1 = ang + open * Math.PI, a2 = ang - open * Math.PI;
    k.drawTriangle({
      p1: k.vec2(0, 0),
      p2: k.vec2(Math.cos(a1) * r * 1.2, Math.sin(a1) * r * 1.2),
      p3: k.vec2(Math.cos(a2) * r * 1.2, Math.sin(a2) * r * 1.2),
      color: k.rgb(0, 0, 0),
    });
  });
}

function mouthAngle(dir: string) {
  return dir === "left" ? Math.PI : dir === "up" ? -Math.PI / 2 : dir === "down" ? Math.PI / 2 : 0;
}

export function attachGhostDraw(obj: GameObj, k: Ctx, graceRef: { v: number }) {
  obj.onDraw(() => {
    const gd = obj.gd as { frightened: boolean };
    if (graceRef.v > 0) obj.opacity = 0.45 + 0.3 * Math.sin(k.time() * 12);
    else obj.opacity = 1;
    const r = 8.5;
    const body = gd.frightened
      ? BLUE(k.rgb)
      : (k as any).Color.fromHex(obj.gd.color as string);
    k.drawCircle({ pos: k.vec2(0, -2), radius: r, color: body });
    k.drawRect({ pos: k.vec2(-r, -2), width: r * 2, height: r, color: body });
    // 底部波浪
    for (let i = 0; i < 3; i++) {
      k.drawCircle({ pos: k.vec2(-r + 2.8 + i * 5.7, r - 3), radius: 2.8, color: body });
    }
    // 眼睛
    const eye = k.rgb(255, 255, 255), pupil = k.rgb(30, 30, 120);
    k.drawCircle({ pos: k.vec2(-3.4, -3), radius: 2.6, color: eye });
    k.drawCircle({ pos: k.vec2(3.4, -3), radius: 2.6, color: eye });
    k.drawCircle({ pos: k.vec2(-2.6, -2.4), radius: 1.3, color: pupil });
    k.drawCircle({ pos: k.vec2(4.2, -2.4), radius: 1.3, color: pupil });
  });
}

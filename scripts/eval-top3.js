/**
 * 系统性评测：对 test-images 里每张图调用线上 /api/describe，
 * 统计"真值流派是否进入 Top3 候选"，并记录排名。
 *
 * 用法：node scripts/eval-top3.js
 */

import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "https://after-the-rain-git-main-liyuxuan200817-2433.vercel.app";
const DIR = "test-images";
const SCHOOLS = ["杨柳青", "桃花坞", "杨家埠", "朱仙镇", "绵竹", "武强", "佛山"];
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const files = fs
  .readdirSync(DIR)
  .filter((f) => EXT.has(path.extname(f).toLowerCase()) && !f.startsWith("_"))
  .map((f) => path.join(DIR, f));

console.log("═".repeat(70));
console.log("  系统性评测：真值流派能否进入 Top3");
console.log(`  目标：${BASE}`);
console.log(`  图片：${files.length} 张`);
console.log("═".repeat(70));

const rows = [];

for (const f of files) {
  const name = path.basename(f);
  const truth = SCHOOLS.find((s) => name.includes(s)) || null;
  const raw = fs.readFileSync(f);
  const dataUrl = `data:${MIME[path.extname(f).toLowerCase()] || "image/jpeg"};base64,${raw.toString("base64")}`;

  process.stdout.write(`\n【${name}】真值=${truth ?? "未知"} … `);

  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/describe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    const data = await res.json();
    const ms = Date.now() - t0;

    if (!res.ok) {
      console.log(`❌ ${data.error}`);
      rows.push({ name, truth, rank: null, ms, cands: [] });
      continue;
    }

    const cands = data.candidates ?? [];
    const idx = truth ? cands.findIndex((c) => c.name.includes(truth)) : -1;

    console.log(`${(ms / 1000).toFixed(1)}s`);
    cands.forEach((c, i) => {
      const mark = truth && c.name.includes(truth) ? "  ← 真值" : "";
      console.log(`    ${i + 1}. ${c.name.padEnd(16)} ${Math.round(c.score * 100)}%${mark}`);
    });
    if (truth && idx === -1) console.log(`    ❌ 真值「${truth}」不在 Top3 内`);

    rows.push({ name, truth, rank: idx, ms, cands });
  } catch (e) {
    console.log(`💥 ${e.message}`);
    rows.push({ name, truth, rank: null, ms: 0, cands: [] });
  }
}

console.log("\n" + "═".repeat(70));
console.log("  汇总");
console.log("═".repeat(70));
console.log("  图片".padEnd(26) + "真值".padEnd(10) + "排名".padEnd(8) + "耗时");
console.log("  " + "─".repeat(52));
for (const r of rows) {
  const rankText = r.rank === null ? "错误" : r.rank === -1 ? "未进Top3" : `第 ${r.rank + 1} 名`;
  const mark = r.rank === 0 ? "✅" : r.rank > 0 ? "🔶" : "❌";
  console.log(`  ${mark} ${r.name.padEnd(22)}${(r.truth ?? "-").padEnd(10)}${rankText.padEnd(10)}${(r.ms / 1000).toFixed(1)}s`);
}

const valid = rows.filter((r) => r.truth && r.rank !== null);
const top1 = valid.filter((r) => r.rank === 0).length;
const top3 = valid.filter((r) => r.rank >= 0).length;
console.log("\n  " + "─".repeat(52));
console.log(`  Top1 命中：${top1}/${valid.length}`);
console.log(`  Top3 命中：${top3}/${valid.length}  (${((top3 / valid.length) * 100).toFixed(0)}%)`);
console.log("═".repeat(70));

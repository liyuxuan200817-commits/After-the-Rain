/**
 * 多模态方案二：视觉描述 → 文本检索
 *
 * 思路：
 *   不让模型"判断流派"（它不擅长，实测准确率 20%）
 *   而是让它"描述视觉特征"，再用描述去检索馆藏档案
 *
 * 用法：node --env-file=.env scripts/verify-vision-v2.js test-images
 */

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.SILICONFLOW_API_KEY;
const VLM = process.env.VISION_MODEL || "Qwen/Qwen3-VL-32B-Instruct";
const EMB = "BAAI/bge-m3";
const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const SCHOOLS = ["杨柳青", "桃花坞", "杨家埠", "朱仙镇", "绵竹", "武强", "佛山"];

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const DESCRIBE_PROMPT = `请客观描述这幅年画的视觉特征，不要判断它属于哪个流派，只描述你看到的。

请按以下五项分别说明：
1. 色彩：主要用了哪些颜色？饱和度高低？对比强不强？
2. 线条：粗细如何？是精雕细琢还是粗犷简练？
3. 技法痕迹：能看出是纯木版套色印刷，还是有手工彩绘/晕染过渡？
4. 题材内容：画的是什么？人物/娃娃/神像/戏曲/花卉？
5. 构图：对称还是散点？留白多还是满构图？

要求：只描述，不下结论。总字数 150-250 字。`;

async function describe(file) {
  const raw = fs.readFileSync(file);
  const mime = MIME[path.extname(file).toLowerCase()] || "image/jpeg";
  const dataUrl = `data:${mime};base64,${raw.toString("base64")}`;

  const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: VLM,
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: DESCRIBE_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`描述失败 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function embed(text) {
  const res = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: EMB, input: [text], encoding_format: "float" }),
  });
  if (!res.ok) throw new Error(`embedding 失败 HTTP ${res.status}`);
  const j = await res.json();
  return j.data[0].embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  if (!KEY) { console.error("缺 SILICONFLOW_API_KEY"); process.exit(1); }

  const dir = process.argv[2] || "test-images";
  const abs = path.resolve(dir);
  const files = fs.statSync(abs).isFile()
    ? [abs]
    : fs.readdirSync(abs).map((f) => path.join(abs, f)).filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()));

  if (files.length === 0) { console.error("没找到图片"); process.exit(1); }

  const store = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "vectors.json"), "utf8"));

  console.log("═".repeat(64));
  console.log("  方案二：视觉描述 → 文本检索");
  console.log(`  视觉模型：${VLM}`);
  console.log(`  检索模型：${EMB}`);
  console.log(`  图片数  ：${files.length}`);
  console.log("═".repeat(64));

  let hit1 = 0, hit2 = 0, total = 0;

  for (const f of files) {
    const name = path.basename(f);
    const truth = SCHOOLS.find((s) => name.includes(s)) || null;

    console.log(`\n【${name}】`);
    if (truth) console.log(`  预期流派：${truth}`);

    try {
      const desc = await describe(f);
      console.log("\n  ── AI 的描述 ──");
      console.log(desc.split("\n").map((l) => "  " + l).join("\n"));

      const dv = await embed(desc);
      const ranked = store
        .map((it) => ({ name: it.name, score: cosine(dv, it.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      console.log("\n  ── 检索结果 ──");
      ranked.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name}   相似度 ${(r.score * 100).toFixed(1)}%`);
      });

      if (truth) {
        total++;
        const top1 = ranked[0]?.name.includes(truth);
        const inTop3 = ranked.some((r) => r.name.includes(truth));
        if (top1) { hit1++; hit2++; console.log("  ✅ Top1 命中"); }
        else if (inTop3) { hit2++; console.log("  🔶 Top3 命中（第一名不对）"); }
        else console.log("  ❌ Top3 都没命中");
      }
    } catch (e) {
      console.log(`  ❌ 出错：${e.message}`);
    }
  }

  console.log("\n" + "═".repeat(64));
  console.log("  验证结论（方案二）");
  console.log("═".repeat(64));
  if (total > 0) {
    console.log(`  可比对：${total} 张`);
    console.log(`  Top1 命中：${hit1} 张  (${((hit1 / total) * 100).toFixed(0)}%)`);
    console.log(`  Top3 命中：${hit2} 张  (${((hit2 / total) * 100).toFixed(0)}%)`);
    console.log("");
    if (hit2 / total >= 0.6) {
      console.log("  ✅ 推荐用这个方案：Top3 命中率 ≥60%");
      console.log("     产品形态：上传图 → 给出 3 个最相似馆藏 + AI 描述依据");
      console.log("     这样即使不中也显得专业，且命中 AI 安全可控的评分点。");
    } else {
      console.log("  ⚠ Top3 命中率也偏低，需要考虑换思路。");
    }
  } else {
    console.log("  没有可比对图片（文件名需含流派名）");
  }
  console.log("═".repeat(64));
}

main().catch((e) => console.error("\n💥", e.message));

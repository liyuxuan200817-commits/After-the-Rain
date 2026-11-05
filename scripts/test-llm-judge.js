/**
 * 实验：用 LLM 对照「七流派鉴别要点」做判断，而不是靠向量检索排序。
 *
 * 对比对象：现状（向量检索 Top3 命中 60%，Top1 命中 0%）
 * 假设：LLM 的语义推理能力比向量相似度更能抓住"半印半绘 vs 纯套色"这类关键差异。
 *
 * 用法：node --env-file=.env scripts/test-llm-judge.js
 */

import fs from "node:fs";
import path from "node:path";

const SF = process.env.SILICONFLOW_API_KEY;
const DS = process.env.DEEPSEEK_API_KEY;
const DIR = "test-images";
const SCHOOLS = ["杨柳青", "桃花坞", "杨家埠", "朱仙镇", "绵竹", "武强", "佛山"];
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** 七个流派的鉴别要点（按"能从画面上看出来"的特征编写） */
const PROFILES = `
【杨柳青】
技法：半印半绘——木版只印墨线轮廓，大面积色彩靠手工敷彩，人物面部有肉色晕染和"开脸"（眉眼唇用笔勾画），能看到手绘笔触。
色彩：雅致柔和，粉红、湖蓝、藕荷等中间色多，对比不强烈。
线条：细而匀，不是粗犷刻线。
题材：仕女、胖娃娃（抱鱼/抱石榴）、戏曲故事。
观感：接近工笔画，有文人气息。

【桃花坞】
技法：一版一色纯套印，无手绘痕迹，色块边界清晰。
色彩：清丽偏冷，蓝、绿、紫较多，对比不强烈。
线条：刻工精细，线条流畅如刀刻，有明确版画味。
题材：戏曲故事、市井生活、仕女。
构图：疏朗，留白较多，常见大段题字。

【杨家埠】
技法：纯木版套色，绝无手绘。
色彩：极浓烈——大红、大绿、亮黄、紫并置，撞色强烈，远看极度醒目。
线条：粗犷简练，块面为主。
题材：门神、财神、灶王、吉祥娃娃。
构图：满构图，几乎不留白。

【朱仙镇】
技法：纯木版套色。
线条：最粗犷有力，如铁线，人物造型古拙，头大、五官高度简化。
色彩：厚重沉稳偏暗，红青黄为主但不艳丽（矿物颜料）。
题材：几乎全是门神。
构图：严格对称。

【绵竹】
技法：以手工彩绘为主（先印墨线再大面积手绘），笔法流畅自由，手绘感强。
色彩：明快通透，大红大绿但不厚重。分"红货"（彩色）"黑货"（墨色）。
题材：门神、戏曲故事。
观感：人物灵动，有写意感。

【武强】
技法：纯木版套色。
色彩：鲜艳但比杨家埠素净，红黄蓝为主。
题材：最具特色的是农事生活场景（耕作、纺织）、节令习俗，乡土气息极浓；也有门神。
构图：朴素，装饰性弱。

【佛山】
技法：大红底 + 手工描金——底色是大红（不是白纸底），再套印其他色，最后用金线勾勒，金红交辉。
色彩：整体呈浓重的红金调，非常华丽。
题材：门神、神像。
观感：与所有北方年画差异极大，红底描金是独有标志。
`;

const JUDGE_PROMPT = `你是中国木版年画鉴定专家。下面给你一幅年画的画面描述，以及七个流派的鉴别要点。

请严格对照「画面描述」中实际能看到的信息，逐条比对鉴别要点来判断。

【画面描述】
{DESC}

【七个流派的鉴别要点】
{PROFILES}

请按以下格式输出：

1. 最可能的流派：（只填一个流派名）
2. 次可能的流派：（填一个，或写"无"）
3. 逐条对照：（分别就技法痕迹、色彩、线条、题材四项，说明与哪个流派吻合/不吻合）
4. 可以排除的流派：（列出并说明理由）
5. 把握程度：（高/中/低；如果描述信息不足以判断，写"信息不足"并说明缺什么）

要求：必须依据描述中实际存在的信息，不许凭流派名气猜测。`;

async function describe(file) {
  const raw = fs.readFileSync(file);
  const dataUrl = `data:${MIME[path.extname(file).toLowerCase()] || "image/jpeg"};base64,${raw.toString("base64")}`;
  const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SF}` },
    body: JSON.stringify({
      model: "Qwen/Qwen3-VL-8B-Instruct",
      temperature: 0.1,
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: `请客观描述这幅年画的视觉特征。

⚠️ 重要提醒：木版套色印刷由于手工刷色和套版对位，天然会有这些现象——套印略微错位、色块边缘不齐、颜料浓淡不均、局部渗化。这些是印刷工艺的正常痕迹，绝不能当成"手绘"。

请回答：
1. 色彩：主色是哪几种？饱和度高低？对比强弱？
2. 线条：粗细如何？精细还是粗犷？
3. 【关键】技法判断：有没有大面积的、有笔触感的手工敷彩或面部晕染？
   - 若为色块平涂、边界清晰（即便有不齐或渗化）→ 明确写"纯套色印刷，无手绘"
   - 若确有人物面部晕染开脸、衣饰大面积手绘笔触 → 说明具体部位
4. 题材内容：画的是什么？
5. 构图：满构图几乎不留白，还是留白较多？

只描述，不下流派结论，150-250字。` },
        ],
      }],
    }),
  });
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function judge(description) {
  const prompt = JUDGE_PROMPT.replace("{DESC}", description).replace("{PROFILES}", PROFILES);
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DS}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function extractRanked(text) {
  const first = text.match(/最可能的流派[：:]\s*[*_`]*\s*(杨柳青|桃花坞|杨家埠|朱仙镇|绵竹|武强|佛山)/);
  const second = text.match(/次可能的流派[：:]\s*[*_`]*\s*(杨柳青|桃花坞|杨家埠|朱仙镇|绵竹|武强|佛山)/);
  return [first?.[1], second?.[1]].filter(Boolean);
}

async function main() {
  const files = fs.readdirSync(DIR)
    .filter((f) => EXT.has(path.extname(f).toLowerCase()) && !f.startsWith("_"))
    .map((f) => path.join(DIR, f));

  console.log("═".repeat(72));
  console.log("  实验：LLM 对照鉴别要点判断流派");
  console.log(`  图片：${files.length} 张`);
  console.log("═".repeat(72));

  const rows = [];

  for (const f of files) {
    const name = path.basename(f);
    const truth = SCHOOLS.find((s) => name.includes(s));
    process.stdout.write(`\n【${name}】真值=${truth} … `);

    try {
      const desc = await describe(f);
      const verdict = await judge(desc);
      const ranked = extractRanked(verdict);
      console.log(`判断=${ranked[0]} 次选=${ranked[1] ?? "无"}`);

      const rank = ranked.indexOf(truth);
      console.log(rank === 0 ? "    ✅ Top1 命中" : rank === 1 ? "    🔶 次选命中" : "    ❌ 未命中");
      console.log("    ── 完整判断 ──");
      console.log(verdict.split("\n").slice(0, 14).map((l) => "    " + l).join("\n"));

      rows.push({ name, truth, rank, ranked });
    } catch (e) {
      console.log(`💥 ${e.message}`);
      rows.push({ name, truth, rank: null, ranked: [] });
    }
  }

  console.log("\n" + "═".repeat(72));
  console.log("  汇总");
  console.log("═".repeat(72));
  const valid = rows.filter((r) => r.rank !== null);
  const top1 = valid.filter((r) => r.rank === 0).length;
  const top2 = valid.filter((r) => r.rank >= 0 && r.rank <= 1).length;
  for (const r of rows) {
    const mark = r.rank === 0 ? "✅" : r.rank === 1 ? "🔶" : "❌";
    console.log(`  ${mark} ${r.name.padEnd(22)} ${r.truth.padEnd(8)} 判断=${r.ranked[0] ?? "-"}`);
  }
  console.log("  " + "─".repeat(60));
  console.log(`  Top1 命中：${top1}/${valid.length}  (${((top1 / valid.length) * 100).toFixed(0)}%)`);
  console.log(`  Top2 命中：${top2}/${valid.length}  (${((top2 / valid.length) * 100).toFixed(0)}%)`);
  console.log("═".repeat(72));
}

main().catch((e) => console.error("💥", e.message));

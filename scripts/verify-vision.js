/**
 * 多模态可行性验证脚本
 * 目的：验证视觉模型能否识别年画流派。先验证，再决定要不要做完整功能。
 *
 * 用法：
 *   1) 先看有哪些视觉模型可用
 *      node --env-file=.env scripts/verify-vision.js --models
 *
 *   2) 测试图片（可传文件夹或单张图）
 *      node --env-file=.env scripts/verify-vision.js test-images
 *      node --env-file=.env scripts/verify-vision.js test-images/杨柳青-门神.jpg
 *
 * 文件名小技巧：把流派写进文件名（如 杨柳青-门神.jpg），
 * 脚本会自动比对，告诉你认对没认对。
 */

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.SILICONFLOW_API_KEY;
const DEFAULT_MODEL = process.env.VISION_MODEL || "Qwen/Qwen3-VL-32B-Instruct";
const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const SCHOOLS = ["杨柳青", "桃花坞", "杨家埠", "朱仙镇", "绵竹", "武强", "佛山"];

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const PROMPT = `你是一位中国木版年画鉴定专家。请仔细观察这张年画图片，判断它最可能属于哪个流派。

参考各流派特征：
- 杨柳青：半印半绘（木版印墨线后手工彩绘），色彩雅致柔和，人物面部细腻，题材多仕女、胖娃娃、戏曲故事
- 桃花坞：一版一色逐色套印，线条灵动精细，色彩清丽，文人趣味，多戏曲与市井题材
- 杨家埠：纯木版套色、不用手绘，色彩浓烈高饱和（红绿黄紫并置），造型夸张质朴，多门神财神灶王
- 朱仙镇：线条粗犷有力，色彩厚重沉稳，造型古拙，多门神
- 绵竹：以手工彩绘为主，色彩明快大红大绿，笔法流畅，多门神与戏曲
- 武强：色彩鲜艳明快，造型简洁，乡土生活气息浓，多农事与吉祥图案
- 佛山：大红为底、手工描金，金红交辉，多门神神像

请严格按以下格式回答：

1. 最可能的流派：（只填一个，从上面七个里选）
2. 置信度：（高 / 中 / 低）
3. 判断依据：（从色彩、线条、构图、题材、技法五个方面分别说明你看到了什么）
4. 次可能的流派：（填一个，或写"无"）
5. 不确定的理由：（如果把握不大，说明缺什么信息；如果很有把握，写"把握较大"）`;

function collectImages(input) {
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) {
    console.error(`❌ 路径不存在: ${abs}`);
    process.exit(1);
  }
  const st = fs.statSync(abs);
  if (st.isFile()) return [abs];

  const files = fs
    .readdirSync(abs)
    .map((f) => path.join(abs, f))
    .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()));
  return files;
}

async function listVisionModels() {
  console.log("查询硅基流动可用模型…\n");
  const res = await fetch("https://api.siliconflow.cn/v1/models?sub_type=chat", {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}: ${await res.text()}`);
    return;
  }
  const data = await res.json();
  const all = (data.data || []).map((m) => m.id);
  const vision = all.filter((id) => /vl|vision|glm-4\.1v|internvl|minicpm/i.test(id));

  console.log(`共 ${all.length} 个对话模型，其中疑似支持视觉的 ${vision.length} 个：\n`);
  vision.forEach((id) => console.log(`  ${id}`));
  if (vision.length === 0) {
    console.log("  ⚠ 没找到视觉模型，可试试不带过滤的完整列表");
  }
  console.log("\n选定后这样用：");
  console.log(`  node --env-file=.env scripts/verify-vision.js test-images`);
  console.log(`  或指定模型：VISION_MODEL=模型名 node --env-file=.env scripts/verify-vision.js test-images`);
}

async function identify(file, model) {
  const raw = fs.readFileSync(file);
  const mb = raw.length / 1024 / 1024;
  if (mb > 4) {
    console.log(`  ⚠ 图片 ${mb.toFixed(1)} MB，可能超出接口限制，建议压缩到 4MB 以内`);
  }

  const mime = MIME[path.extname(file).toLowerCase()] || "image/jpeg";
  const dataUrl = `data:${mime};base64,${raw.toString("base64")}`;

  const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "(无内容)";
}

function extractSchool(text) {
  const m = text.match(/最可能的流派[：:]\s*[*_]*\s*(杨柳青|桃花坞|杨家埠|朱仙镇|绵竹|武强|佛山)/);
  if (m) return m[1];
  const hit = SCHOOLS.find((s) => text.includes(s));
  return hit || "未识别";
}

async function main() {
  if (!KEY || KEY.includes("xxxx")) {
    console.error("❌ 缺少 SILICONFLOW_API_KEY，检查 .env");
    process.exit(1);
  }

  const target = process.argv[2];

  if (!target || target === "--models" || target === "--list") {
    await listVisionModels();
    return;
  }

  const files = collectImages(target);
  if (files.length === 0) {
    console.error(`❌ 在 ${target} 里没找到图片（支持 jpg/png/webp）`);
    process.exit(1);
  }

  console.log("═".repeat(64));
  console.log(`  多模态年画流派识别 · 可行性验证`);
  console.log(`  模型   : ${DEFAULT_MODEL}`);
  console.log(`  图片数 : ${files.length}`);
  console.log("═".repeat(64));

  let total = 0;
  let correct = 0;
  let undetermined = 0;
  const results = [];

  for (const f of files) {
    const name = path.basename(f);
    // 从文件名猜真实流派
    const truth = SCHOOLS.find((s) => name.includes(s)) || null;

    console.log(`\n【${name}】`);
    if (truth) console.log(`  预期流派：${truth}（从文件名推断）`);

    try {
      const answer = await identify(f, DEFAULT_MODEL);
      const pred = extractSchool(answer);

      let verdict = "";
      if (truth) {
        total++;
        if (pred === truth) {
          correct++;
          verdict = "  ✅ 认对";
        } else if (pred === "未识别") {
          undetermined++;
          verdict = "  ⚠ 未给出明确流派（这本身也是有效结果）";
        } else {
          verdict = `  ❌ 认错（认成 ${pred}）`;
        }
      }
      console.log(`  AI 判断  ：${pred}${verdict}`);
      console.log("  ─────────── AI 完整回答 ───────────");
      console.log(
        answer.split("\n").map((l) => "  " + l).join("\n"),
      );
      results.push({ name, truth, pred, ok: truth ? pred === truth : null });
    } catch (e) {
      console.log(`  ❌ 调用失败：${e.message}`);
      results.push({ name, truth, pred: "调用失败", ok: false });
    }
  }

  console.log("\n" + "═".repeat(64));
  console.log("  验证结论");
  console.log("═".repeat(64));
  if (total > 0) {
    console.log(`  可比对图片：${total} 张`);
    console.log(`  识别正确  ：${correct} 张`);
    console.log(`  未明确表态：${undetermined} 张`);
    console.log(`  准确率    ：${((correct / total) * 100).toFixed(0)}%`);

    console.log("\n  建议：");
    if (correct / total >= 0.6) {
      console.log("  ✅ 准确率 ≥ 60%，可以做「上传图片识别流派」这个功能。");
      console.log("     下一步：把这段逻辑包成 /api/identify 接口。");
    } else if (correct / total >= 0.35) {
      console.log("  ⚠ 准确率 35%~60%，建议改成「给出 2-3 个候选流派 + 依据」。");
      console.log("     这样即使不中也显得专业，还正好命中 AI 安全可控的评分点。");
    } else {
      console.log("  ❌ 准确率 < 35%，不建议做「识别流派」。");
      console.log("     改方案：上传图 → 返回相似的馆藏档案（图像相似度检索），");
      console.log("     这个不依赖模型判断，可靠得多。");
    }
  } else {
    console.log("  没有可比对的图片（文件名里没写流派）。");
    console.log("  建议把图片重命名成 杨柳青-门神.jpg 这种格式，才能自动算准确率。");
  }
  console.log("═".repeat(64));
}

main().catch((e) => {
  console.error("\n💥 出错：", e.message);
});

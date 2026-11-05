/**
 * 视觉能力：看图 → 描述 → 检索 → 讲解
 *
 * ⚠️ 重要设计决策（写进技术文档的素材）：
 *
 * 最初的设计是"上传年画 → 直接识别流派"。
 * 但用 5 张不同流派的年画实测后，准确率只有 20%：
 *   佛山-神像   → 猜成杨家埠
 *   朱仙镇-门神 → 猜成杨家埠
 *   杨家埠-财神 → 猜对
 *   杨柳青-门神 → 猜成杨家埠
 *   桃花坞-戏曲 → 猜成杨柳青
 * 规律是模型只在按"色彩浓淡"归类，并未区分流派特征，且每次都自称"把握较大"。
 *
 * 因此改为三步走：
 *   ① 视觉模型"只描述不判断"（描述是它的强项）
 *   ② 用描述文本做向量检索，找出最相似的馆藏档案
 *   ③ 由文本模型基于"画面描述 + 馆藏资料"写讲解，流派只说"可能是"，不断言
 *
 * 这样即使不中，输出依然是'有信息量的专业内容'，而不是一个错误结论。
 */

import { embed, cosine, loadStore, type VectorItem } from "./rag";

const SF_KEY = process.env.SILICONFLOW_API_KEY;
const VISION_MODEL = process.env.VISION_MODEL || "Qwen/Qwen3-VL-32B-Instruct";

export type Candidate = {
  name: string;
  school: string;
  region: string;
  score: number;
};

const DESCRIBE_PROMPT = `请客观描述这幅年画的视觉特征，不要判断它属于哪个流派，只描述你看到的。

请按以下五项分别说明：
1. 色彩：主要用了哪些颜色？饱和度高低？对比强不强？
2. 线条：粗细如何？是精雕细琢还是粗犷简练？
3. 技法痕迹：能看出是纯木版套色印刷，还是有手工彩绘/晕染过渡？
4. 题材内容：画的是什么？人物/娃娃/神像/戏曲/花卉？有无文字？
5. 构图：对称还是散点？留白多还是满构图？

要求：只描述客观可见的内容，不下流派结论。总字数 150-250 字。`;

/** 第一步：让视觉模型只做描述 */
export async function describeImage(dataUrl: string): Promise<string> {
  if (!SF_KEY) throw new Error("服务端缺少 SILICONFLOW_API_KEY");

  const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SF_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 700,
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

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 402) {
      throw new Error("视觉模型额度不足（硅基流动账户余额为 0），请充值后重试");
    }
    throw new Error(`视觉模型返回 HTTP ${res.status}：${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("视觉模型没有返回内容");
  return text;
}

/** 第二步：用描述文本检索馆藏，返回最相似的 N 条 */
export async function retrieveByDescription(
  description: string,
  topK = 3,
): Promise<Candidate[]> {
  const store = loadStore();
  const dv = await embed(description);

  return store
    .map((it: VectorItem) => ({
      name: it.name,
      school: it.school ?? "通用",
      region: it.region,
      score: cosine(dv, it.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 第三步：生成讲解（由调用方使用 DeepSeek，这里只负责拼 Prompt） */
export function buildInterpretMessages(description: string, candidates: Candidate[]) {
  const refs = candidates
    .map(
      (c, i) =>
        `【参考档案${i + 1}】${c.name}（${c.school}流派，${c.region}）相似度 ${(c.score * 100).toFixed(0)}%`,
    )
    .join("\n");

  const detail = loadStore()
    .filter((it) => candidates.some((c) => c.name === it.name))
    .map((it) => `${it.text}`)
    .join("\n\n");

  return [
    {
      role: "system" as const,
      content: `你是"雨后天晴 · 年画档案助手"的讲解员。用户上传了一张年画照片，系统已经让视觉模型描述了画面，并检索到了相近的馆藏档案。

请据此写一段讲解，严格按以下结构：

【这幅画的是什么】
依据画面描述，说清题材与画面内容（画了什么人物、在做什么、有无文字）。

【寓意】
解读画面里的吉祥寓意，说明是谐音还是典故，讲清由来。

【可能属于的流派】
用"可能是……也可能是……"的措辞，最多提两个，并说明依据（色彩、线条、技法）。**不许直接断言属于某个流派**，因为视觉识别并不完全可靠。

【温馨提示】
一句话提醒：准确鉴定需专业机构结合实物与文献判断。

硬性要求：
- 只能使用提供的画面描述和馆藏资料，不许编造。
- 如果资料里没有对应内容，如实说"馆藏未收录相关条目"。
- 语言亲切通俗，面向普通观众，总字数 300-450 字。`,
    },
    {
      role: "user" as const,
      content: `【画面描述（视觉模型所见）】\n${description}\n\n【检索到的相近档案】\n${refs}\n\n【档案正文】\n${detail}`,
    },
  ];
}

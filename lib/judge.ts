import { profilesAsText, SCHOOL_NAMES } from "@/lib/schools";
import { loadStore } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export type JudgedCandidate = {
  name: string;
  school: string;
  region: string;
  confidence: "高" | "中" | "低";
  reason: string;
};

const JUDGE_SYSTEM = `你是中国木版年画鉴定专家。用户提供一段由视觉模型生成的「画面描述」，
你需要严格对照七个流派的鉴别要点，判断这幅画最可能属于哪个流派。

核心原则：
1. 只依据描述中【实际出现】的信息判断，不许凭流派名气或常见印象猜测。
2. 特别注意"技法"这一项：木版套色印刷天然的套印不齐、色块边缘不齐、颜料浓淡不均，
   都是印刷工艺的正常痕迹，绝不能当作"手绘"。只有大面积的、有笔触感的手工敷彩
   和人物面部晕染开脸，才算"半印半绘/手绘"。
3. 若描述中的信息不足以支撑判断，confidence 填"低"，并说明缺什么信息。
4. 必须给出可核查的理由，指出描述中的哪句话与哪个流派的哪个要点吻合或不吻合。

只输出 JSON，不要任何其他文字。`;

function buildUserPrompt(description: string) {
  return `【画面描述】
${description}

【七个流派的鉴别要点】
${profilesAsText()}

【输出格式（严格 JSON）】
{
  "ranked": [
    { "school": "流派名（必须是七者之一）", "confidence": "高|中|低", "reason": "20-40字，说明依据描述中哪句话与哪个要点吻合" }
  ],
  "excluded": [
    { "school": "流派名", "reason": "15-30字，说明为什么排除" }
  ]
}

要求：
- ranked 按可能性从高到低排列，最多 3 个。
- excluded 列出可以明确排除的流派，最多 3 个。
- 所有 school 字段必须是这七个之一：${SCHOOL_NAMES.join("、")}。`;
}

/** 调 DeepSeek 做对照判断，返回按可能性排序的候选 */
export async function judgeByProfiles(description: string): Promise<{
  ranked: { school: string; confidence: "高" | "中" | "低"; reason: string }[];
  excluded: { school: string; reason: string }[];
}> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("服务端缺少 DEEPSEEK_API_KEY");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.1,
      // JSON 模式：保证输出可解析
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: buildUserPrompt(description) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`判断失败 HTTP ${res.status}：${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("判断结果为空");

  let parsed: {
    ranked?: { school: string; confidence: string; reason: string }[];
    excluded?: { school: string; reason: string }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("判断结果不是合法 JSON");
  }

  const valid = (s: string) => SCHOOL_NAMES.includes(s);

  const ranked = (parsed.ranked ?? [])
    .filter((r) => valid(r.school))
    .slice(0, 3)
    .map((r) => ({
      school: r.school,
      confidence: (["高", "中", "低"].includes(r.confidence) ? r.confidence : "中") as
        | "高"
        | "中"
        | "低",
      reason: r.reason ?? "",
    }));

  const excluded = (parsed.excluded ?? [])
    .filter((r) => valid(r.school))
    .slice(0, 3)
    .map((r) => ({ school: r.school, reason: r.reason ?? "" }));

  if (ranked.length === 0) throw new Error("判断结果中没有有效的流派");

  return { ranked, excluded };
}

/** 把流派名映射回馆藏档案，补全 name / region */
export function toCandidates(
  ranked: { school: string; confidence: "高" | "中" | "低"; reason: string }[],
): JudgedCandidate[] {
  const store = loadStore();
  return ranked.map((r) => {
    const hit = store.find((it) => it.school === r.school || it.name.includes(r.school));
    return {
      name: hit?.name ?? `${r.school}木版年画`,
      school: r.school,
      region: hit?.region ?? "",
      confidence: r.confidence,
      reason: r.reason,
    };
  });
}

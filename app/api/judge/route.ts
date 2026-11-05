import { judgeByProfiles, toCandidates } from "@/lib/judge";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 第二步：对照七个流派的鉴别要点，判断这幅画最可能属于哪个流派
 *
 * 请求：POST { description }
 * 响应：{
 *   candidates: [{ name, school, region, confidence, reason }],  // 按可能性排序，最多3个
 *   excluded:   [{ school, reason }],                            // 可排除的流派
 * }
 *
 * 为什么用大模型判断而不是向量检索：
 * 向量相似度只能比"字面像不像"，抓不住"半印半绘 vs 纯套色"这类关键差异。
 * 实测对比见 docs/技术决策记录.md。
 */
export async function POST(req: Request) {
  const started = Date.now();

  try {
    const { description } = (await req.json()) as { description?: string };

    if (!description || description.trim().length < 20) {
      return Response.json({ error: "画面描述太短，无法判断" }, { status: 400 });
    }

    const { ranked, excluded } = await judgeByProfiles(description);
    const candidates = toCandidates(ranked);

    return Response.json({
      candidates,
      excluded,
      elapsedMs: Date.now() - started,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    endpoint: "/api/judge",
    method: "POST",
    body: { description: "..." },
    returns: { candidates: "按可能性排序的流派候选", excluded: "可排除的流派" },
  });
}

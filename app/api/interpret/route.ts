import { describeImage, retrieveByDescription, buildInterpretMessages } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 看图讲年画
 *
 * 请求：POST JSON  { image: "data:image/jpeg;base64,..." }
 * 响应：JSON
 *   {
 *     description: 视觉模型看到的画面,
 *     candidates: 最相似的馆藏 Top3,
 *     interpretation: 讲解正文,
 *     disclaimer: 免责提示
 *   }
 */
export async function POST(req: Request) {
  const started = Date.now();

  try {
    const body = (await req.json()) as { image?: string };
    const image = body.image;

    if (!image || !image.startsWith("data:image/")) {
      return Response.json(
        { error: "请上传图片（需要 data:image/... 格式的 base64）" },
        { status: 400 },
      );
    }

    // 粗略体积检查：base64 约为原始大小的 1.37 倍
    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > 4 * 1024 * 1024) {
      return Response.json(
        { error: "图片过大（超过约 4MB），请在浏览器端压缩后再上传" },
        { status: 413 },
      );
    }

    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      return Response.json(
        { error: "服务端缺少 DEEPSEEK_API_KEY，请检查环境变量配置" },
        { status: 500 },
      );
    }

    // ① 视觉描述
    const description = await describeImage(image);

    // ② 检索相近馆藏
    const candidates = await retrieveByDescription(description, 3);

    // ③ 生成讲解
    const llm = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dsKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: buildInterpretMessages(description, candidates),
        temperature: 0.4,
        stream: false,
      }),
    });

    if (!llm.ok) {
      const err = await llm.text();
      return Response.json(
        { error: `讲解生成失败 HTTP ${llm.status}`, detail: err.slice(0, 300) },
        { status: 502 },
      );
    }

    const llmData = (await llm.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const interpretation = llmData.choices?.[0]?.message?.content ?? "";

    return Response.json({
      description,
      candidates,
      interpretation,
      disclaimer:
        "本结果由 AI 基于画面描述与馆藏资料生成，仅供文化了解；准确鉴定请由专业机构结合实物与文献判断。",
      elapsedMs: Date.now() - started,
    });
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: msg }, { status: 500 });
  }
}

/** 便于用浏览器直接打开页面确认接口存活 */
export async function GET() {
  return Response.json({
    endpoint: "/api/interpret",
    method: "POST",
    body: { image: "data:image/jpeg;base64,..." },
    note: "上传一张年画照片，返回画面描述、相近馆藏与讲解",
  });
}

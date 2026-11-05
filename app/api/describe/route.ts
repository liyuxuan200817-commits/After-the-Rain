import { describeImage } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 第一步：只看图，产出画面描述
 *
 * 请求：POST { image: "data:image/jpeg;base64,..." }
 * 响应：{ description }
 *
 * 说明：这里不再做向量检索。经实测（见 docs/技术决策记录.md ADR-002/ADR-008），
 * 向量检索对"流派归属"的区分度很低（所有相似度挤在 60–65%，且佛山被误排第一 4/5 次）。
 * 流派判断改由 /api/judge 用大模型对照鉴别要点完成。
 */
export async function POST(req: Request) {
  const started = Date.now();

  try {
    const { image } = (await req.json()) as { image?: string };

    if (!image || !image.startsWith("data:image/")) {
      return Response.json({ error: "请上传图片（data:image/... 格式）" }, { status: 400 });
    }

    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > 4 * 1024 * 1024) {
      return Response.json(
        { error: "图片过大（超过约 4MB），请在浏览器端压缩后再上传" },
        { status: 413 },
      );
    }

    const description = await describeImage(image);

    return Response.json({
      description,
      elapsedMs: Date.now() - started,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("额度不足") ? 402 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function GET() {
  return Response.json({
    endpoint: "/api/describe",
    method: "POST",
    body: { image: "data:image/jpeg;base64,..." },
    returns: { description: "画面客观描述" },
    next: "把 description 传给 /api/judge",
  });
}

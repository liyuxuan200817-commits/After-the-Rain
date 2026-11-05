import { describeImage, retrieveByDescription } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 第一步：看图 + 检索相近馆藏
 *
 * 请求：POST { image: "data:image/jpeg;base64,..." }
 * 响应：{ description, candidates }
 *
 * 这一步只做视觉描述和向量检索，不做长文本生成，
 * 因此耗时稳定在 10–20 秒，不会触及 Vercel 60 秒上限。
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
    const candidates = await retrieveByDescription(description, 3);

    return Response.json({
      description,
      candidates,
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
    returns: ["description", "candidates"],
  });
}

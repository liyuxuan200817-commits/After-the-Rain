import { buildInterpretMessages, type Candidate } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 第二步：根据画面描述 + 相近馆藏，生成讲解（流式）
 *
 * 请求：POST { description, candidates }
 * 响应：纯文本流（SSE 已被转换成纯文本，前端直接读字符串）
 *
 * 拆成两步的原因：
 * 一次性完成「看图 + 检索 + 长文本生成」在 Vercel 上实测耗时 57.6 秒，
 * 已经逼近 60 秒上限，随时可能超时。
 * 拆开后本步约 20–30 秒，安全裕度充足；
 * 且前端可以先展示"看到了什么 + 相近馆藏"，再逐步显示讲解，体验更好。
 */
export async function POST(req: Request) {
  try {
    const { description, candidates } = (await req.json()) as {
      description?: string;
      candidates?: Candidate[];
    };

    if (!description || !candidates || candidates.length === 0) {
      return new Response("缺少 description 或 candidates", { status: 400 });
    }

    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      return new Response("服务端缺少 DEEPSEEK_API_KEY", { status: 500 });
    }

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dsKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: buildInterpretMessages(description, candidates),
        temperature: 0.4,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text();
      return new Response(`模型调用失败 HTTP ${upstream.status}\n${err.slice(0, 300)}`, {
        status: 502,
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                // 分片不完整，忽略
              }
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`\n\n[流式传输中断] ${(e as Error).message}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (e) {
    return new Response(`服务端错误：${(e as Error).message}`, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    endpoint: "/api/compose",
    method: "POST",
    body: { description: "...", candidates: [{ name: "...", school: "...", region: "...", score: 0.6 }] },
    returns: "text/plain 流式讲解",
  });
}

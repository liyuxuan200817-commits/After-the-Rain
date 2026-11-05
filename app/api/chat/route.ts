import { retrieve, buildMessages } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };

    if (!question || !question.trim()) {
      return new Response("请先输入问题", { status: 400 });
    }

    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      return new Response(
        [
          "服务端缺少 DEEPSEEK_API_KEY。",
          "",
          "如果你看到这句话，说明程序正在线上运行但没读到密钥。",
          "本地开发：检查 .env 文件是否填写。",
          "线上部署：到 Vercel → 项目 → Settings → Environment Variables",
          "          添加 DEEPSEEK_API_KEY，然后重新部署（Redeploy）。",
          "",
          "详细自检：访问 /api/health",
        ].join("\n"),
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    // ① 检索
    const hits = await retrieve(question, 2);

    // ② 调大模型，流式返回
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dsKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: buildMessages(question, hits),
        stream: true,
        temperature: 0.3,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text();
      return new Response(`模型调用失败 HTTP ${upstream.status}\n${err}`, { status: 502 });
    }

    // ③ 把 SSE 转成纯文本流，前端直接读字符串即可
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

    // 把命中的档案名放在响应头里，前端可展示"参考了哪些档案"
    const hitNames = encodeURIComponent(hits.map((h) => h.name).join(","));

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Hits": hitNames,
      },
    });
  } catch (e) {
    return new Response(`服务端错误：${(e as Error).message}`, { status: 500 });
  }
}

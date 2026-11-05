import { loadStore } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 环境自检接口
 *
 *   GET /api/health          只检查配置是否存在（不花钱）
 *   GET /api/health?deep=1   真实调用一次，确认 Key 有效且余额足够
 *
 * 为什么需要 deep 模式：
 * 曾经出现过"Key 存在但余额为 0"的情况，此时普通检查显示 ok=true，
 * 但实际所有问答都会失败。deep 模式能把这种情况暴露出来。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  const ds = process.env.DEEPSEEK_API_KEY;
  const sf = process.env.SILICONFLOW_API_KEY;

  let vectorCount = 0;
  let dataError = "";
  try {
    vectorCount = loadStore().length;
  } catch (e) {
    dataError = (e as Error).message;
  }

  const envOk = Boolean(ds) && Boolean(sf) && vectorCount > 0 && !dataError;

  // ---- 深度检查：真实调用两端接口 ----
  type Probe = { ok: boolean; detail: string };
  const probes: Record<string, Probe> = {};

  if (deep) {
    // 硅基流动 embedding
    if (sf) {
      try {
        const res = await fetch("https://api.siliconflow.cn/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sf}` },
          body: JSON.stringify({ model: "BAAI/bge-m3", input: ["健康检查"], encoding_format: "float" }),
        });
        if (res.ok) {
          probes.siliconflow = { ok: true, detail: "embedding 调用成功" };
        } else {
          const t = await res.text();
          probes.siliconflow = {
            ok: false,
            detail:
              res.status === 402
                ? "余额不足，请到 cloud.siliconflow.cn 充值"
                : `HTTP ${res.status}: ${t.slice(0, 120)}`,
          };
        }
      } catch (e) {
        probes.siliconflow = { ok: false, detail: `网络错误：${(e as Error).message}` };
      }
    } else {
      probes.siliconflow = { ok: false, detail: "未配置" };
    }

    // DeepSeek 对话
    if (ds) {
      try {
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ds}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        });
        if (res.ok) {
          probes.deepseek = { ok: true, detail: "对话调用成功" };
        } else {
          const t = await res.text();
          probes.deepseek = {
            ok: false,
            detail:
              res.status === 401
                ? "Key 无效"
                : res.status === 402
                  ? "余额不足，请到 platform.deepseek.com 充值"
                  : `HTTP ${res.status}: ${t.slice(0, 120)}`,
          };
        }
      } catch (e) {
        probes.deepseek = { ok: false, detail: `网络错误：${(e as Error).message}` };
      }
    } else {
      probes.deepseek = { ok: false, detail: "未配置" };
    }
  }

  const probesOk = !deep || Object.values(probes).every((p) => p.ok);
  const ok = envOk && probesOk;

  const hints: string[] = [];
  if (!ds) hints.push("缺少 DEEPSEEK_API_KEY：到 Vercel → Settings → Environment Variables 添加，然后 Redeploy");
  if (!sf) hints.push("缺少 SILICONFLOW_API_KEY：同上");
  if (vectorCount === 0) hints.push("向量库为空：本地运行 npm run embed 后提交 data/vectors.json");
  if (dataError) hints.push(`数据读取失败：${dataError}`);
  for (const [name, p] of Object.entries(probes)) {
    if (!p.ok) hints.push(`${name}: ${p.detail}`);
  }
  if (ok) hints.push("配置正常，可以正常问答与看图");

  return Response.json(
    {
      ok,
      mode: deep ? "deep" : "basic",
      env: {
        DEEPSEEK_API_KEY: ds ? `已配置（长度 ${ds.length}）` : "缺失",
        SILICONFLOW_API_KEY: sf ? `已配置（长度 ${sf.length}）` : "缺失",
      },
      vectorCount,
      dataError: dataError || null,
      ...(deep ? { probes } : {}),
      hints,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}

import { loadStore } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 环境自检接口
 * 访问 https://你的域名/api/health 可以看到服务端配置状态
 * 只显示"是否配置"，不会泄露 Key 的具体内容
 */
export async function GET() {
  const ds = process.env.DEEPSEEK_API_KEY;
  const sf = process.env.SILICONFLOW_API_KEY;

  let vectorCount = 0;
  let dataError = "";

  try {
    vectorCount = loadStore().length;
  } catch (e) {
    dataError = (e as Error).message;
  }

  const ok = Boolean(ds) && Boolean(sf) && vectorCount > 0 && !dataError;

  const hints: string[] = [];
  if (!ds) hints.push("缺少 DEEPSEEK_API_KEY：去 Vercel → Settings → Environment Variables 添加");
  if (!sf) hints.push("缺少 SILICONFLOW_API_KEY：同上");
  if (vectorCount === 0) hints.push("向量库为空或未打包：本地跑 npm run embed 后提交 data/vectors.json");
  if (dataError) hints.push(`数据读取失败：${dataError}`);
  if (ok) hints.push("配置正常，可以正常问答");

  return Response.json(
    {
      ok,
      env: {
        DEEPSEEK_API_KEY: ds ? "已配置（长度 " + ds.length + "）" : "缺失",
        SILICONFLOW_API_KEY: sf ? "已配置（长度 " + sf.length + "）" : "缺失",
      },
      vectorCount,
      dataError: dataError || null,
      hints,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}

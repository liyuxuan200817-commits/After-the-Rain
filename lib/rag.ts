import fs from "node:fs";
import path from "node:path";

export type Item = {
  id: string;
  name: string;
  school?: string;
  category: string;
  batch?: string;
  region: string;
  technique?: string;
  style?: string;
  themes?: string[];
  symbolism?: string;
  summary?: string;
  process?: string[];
  materials?: string[];
};

export type VectorItem = Item & { text: string; vector: number[] };

/** 读取原始档案（用于首页展示） */
export function loadItems(): Item[] {
  const p = path.join(process.cwd(), "data", "ich-items.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as Item[];
}

let cachedStore: VectorItem[] | null = null;

/** 读取向量库（缓存，避免每次请求都读盘） */
export function loadStore(): VectorItem[] {
  if (cachedStore) return cachedStore;
  const p = path.join(process.cwd(), "data", "vectors.json");
  cachedStore = JSON.parse(fs.readFileSync(p, "utf8")) as VectorItem[];
  return cachedStore;
}

/** 余弦相似度 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 调用硅基流动做 embedding */
export async function embed(text: string): Promise<number[]> {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) throw new Error("缺少 SILICONFLOW_API_KEY");

  const res = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "BAAI/bge-m3",
      input: [text],
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    throw new Error(`embedding 接口返回 HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

/** 检索最相关的 topK 条档案 */
export async function retrieve(question: string, topK = 2): Promise<VectorItem[]> {
  const store = loadStore();
  const qv = await embed(question);
  return store
    .map((item) => ({ ...item, vector: item.vector, _score: cosine(qv, item.vector) }))
    .sort((a, b) => (b as VectorItem & { _score: number })._score - (a as VectorItem & { _score: number })._score)
    .slice(0, topK) as VectorItem[];
}

export const SYSTEM_PROMPT = `你是"雨后天晴 · 年画档案助手"，专门解答中国木版年画的问题，只依据提供的馆藏资料回答。

严格规则：
1. 只能使用【馆藏资料】里的内容回答，不许编造。
2. 如果资料里没有答案，必须明确回复："馆藏未收录相关内容。"并建议用户换个问法或换一幅年画。
3. 涉及流派判断时，要说清依据（技法特征、色彩风格、题材、产地），不要只给结论。
4. 回答最后必须单独一行标注来源，格式：—— 出自《档案名》馆藏档案
5. 语言亲切简洁，面向普通观众，不堆砌术语；提到寓意时说明谐音或典故由来。`;

/** 组装 Prompt */
export function buildMessages(question: string, hits: VectorItem[]) {
  const context = hits
    .map((h, i) => `【资料${i + 1}：${h.name}】\n${h.text}\n来源：${h.region}`)
    .join("\n\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `【馆藏资料】\n${context}\n\n【用户问题】\n${question}`,
    },
  ];
}

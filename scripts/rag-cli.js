/**
 * 第 3 天 · 完整 RAG：检索 → 喂给大模型 → 回答带出处
 * 运行：node --env-file=.env rag/rag.js "刺绣用什么线"
 *
 * 这就是比赛要的核心能力：查着资料回答，不许瞎编。
 */

import fs from 'node:fs';
import path from 'node:path';

const DS_KEY = process.env.DEEPSEEK_API_KEY;
const SF_KEY = process.env.SILICONFLOW_API_KEY;

if (!DS_KEY || DS_KEY.includes('xxxx')) {
  console.error('\n❌ 缺少 DEEPSEEK_API_KEY，先填 .env\n');
  process.exit(1);
}
if (!SF_KEY || SF_KEY.includes('xxxx')) {
  console.error('\n❌ 缺少 SILICONFLOW_API_KEY，先填 .env\n');
  process.exit(1);
}

const VEC_PATH = path.join(process.cwd(), 'data', 'vectors.json');

async function embedOne(text) {
  const res = await fetch('https://api.siliconflow.cn/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SF_KEY}` },
    body: JSON.stringify({ model: 'BAAI/bge-m3', input: [text], encoding_format: 'float' }),
  });
  if (!res.ok) throw new Error(`embedding HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const question = process.argv.slice(2).join(' ') || '刺绣用什么线';

  if (!fs.existsSync(VEC_PATH)) {
    console.error('❌ 请先运行 rag/embed.js 生成向量');
    process.exit(1);
  }
  const store = JSON.parse(fs.readFileSync(VEC_PATH, 'utf8'));

  // ---- 第一步：检索 ----
  const qv = await embedOne(question);
  const top = store
    .map((it) => ({ ...it, score: cosine(qv, it.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  console.log(`❓ 问题：${question}`);
  console.log(`🔍 命中馆藏：${top.map((t) => t.name).join('、')}`);
  console.log(`   相似度：${top.map((t) => (t.score * 100).toFixed(1) + '%').join(' / ')}\n`);

  // ---- 第二步：拼 Prompt ----
  const context = top
    .map((t, i) => `【资料${i + 1}：${t.name}】\n${t.text}\n来源：${t.region}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content: `你是"雨后天晴 · 年画档案助手"，专门解答中国木版年画的问题，只依据提供的馆藏资料回答。

严格规则：
1. 只能使用【馆藏资料】里的内容回答，不许编造。
2. 如果资料里没有答案，必须明确回复："馆藏未收录相关内容。"并建议用户换个问法或换一幅年画。
3. 涉及流派判断时，要说清依据（技法特征、色彩风格、题材、产地），不要只给结论。
4. 回答最后必须单独一行标注来源，格式：—— 出自《档案名》馆藏档案
5. 语言亲切简洁，面向普通观众，不堆砌术语；提到寓意时说明谐音或典故由来。`,
    },
    {
      role: 'user',
      content: `【馆藏资料】\n${context}\n\n【用户问题】\n${question}`,
    },
  ];

  // ---- 第三步：调用大模型（流式）----
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DS_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, stream: true, temperature: 0.3 }),
  });

  if (!res.ok) {
    console.error(`❌ DeepSeek HTTP ${res.status}`);
    console.error(await res.text());
    return;
  }

  console.log('✅ 回答：\n');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { process.stdout.write(delta); full += delta; }
      } catch {}
    }
  }

  console.log('\n\n' + '─'.repeat(50));
  const hasSource = /出自|来源|馆藏档案/.test(full);
  const refused = /馆藏未收录/.test(full);
  console.log(hasSource ? '✅ 回答里带了出处' : '⚠️ 回答里没看到出处，检查 Prompt');
  if (refused) console.log('✅ 正确触发了"馆藏未收录"兜底');
  console.log('─'.repeat(50));
}

main().catch((e) => {
  console.error('\n💥 出错：', e.message);
});

/**
 * 第 2 天 · 步骤二：测试检索（这一步不调大模型，只测"找得准不准"）
 * 运行：node --env-file=.env rag/search.js "刺绣用什么线"
 *
 * 作用：把你的问题也变成向量，和库里的向量算"相似度"，找出最像的几条。
 */

import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY || KEY.includes('xxxx')) {
  console.error('\n❌ 缺少 SILICONFLOW_API_KEY，先填 .env\n');
  process.exit(1);
}

const VEC_PATH = path.join(process.cwd(), 'data', 'vectors.json');

async function embedOne(text) {
  const res = await fetch('https://api.siliconflow.cn/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ model: 'BAAI/bge-m3', input: [text], encoding_format: 'float' }),
  });
  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}`, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

// 余弦相似度：两个向量"方向"越接近，值越接近 1
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const question = process.argv.slice(2).join(' ') || '刺绣用什么线';

  if (!fs.existsSync(VEC_PATH)) {
    console.error(`❌ 找不到 ${VEC_PATH}`);
    console.error('   请先运行  node --env-file=.env rag/embed.js');
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(VEC_PATH, 'utf8'));
  console.log(`❓ 问题：${question}`);
  console.log(`📚 库里有 ${store.length} 条档案\n`);

  const qv = await embedOne(question);

  const ranked = store
    .map((item) => ({ ...item, score: cosine(qv, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  console.log('🏆 检索结果（按相似度排序）：\n');
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}   相似度 ${(r.score * 100).toFixed(1)}%`);
    console.log(`     ${r.category} · ${r.region}`);
  });

  console.log('\n--- 最高分那条的完整内容（后面要喂给大模型）---\n');
  console.log(ranked[0].text);

  console.log('\n✅ 如果第 1 名看起来是"对的"，说明检索做通了');
  console.log('下一步：运行  node --env-file=.env rag/rag.js "刺绣用什么线"');
}

main().catch((e) => {
  console.error('\n💥 出错：', e.message);
});

/**
 * 第 2 天 · 步骤一：把非遗档案变成向量
 * 运行：node --env-file=.env rag/embed.js
 *
 * 作用：读完 data/ich-items.json，把每条非遗的文字送去做 embedding，
 *       得到一串数字（向量），存到 data/vectors.json，供后面检索用。
 */

import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY || KEY.includes('xxxx')) {
  console.error('\n❌ 没有找到 SILICONFLOW_API_KEY');
  console.error('   请打开 .env 文件，把这一行换成你的真实 Key：');
  console.error('   SILICONFLOW_API_KEY=sk-你的硅基流动Key\n');
  process.exit(1);
}

const ROOT = process.cwd();
const ITEMS_PATH = path.join(ROOT, 'data', 'ich-items.json');
const OUT_PATH = path.join(ROOT, 'data', 'vectors.json');

// 把一条年画档案摊平成一段可被检索的文字
function toChunk(item) {
  return [
    `【${item.name}】`,
    `流派：${item.school}`,
    `类别：${item.category}`,
    `批次：${item.batch}`,
    `产地：${item.region}`,
    `技法：${item.technique}`,
    `风格：${item.style}`,
    `常见题材：${item.themes?.join('、') ?? ''}`,
    `寓意：${item.symbolism}`,
    `简介：${item.summary}`,
    item.process?.length ? `工艺流程：${item.process.join(' → ')}` : '',
    item.materials?.length ? `主要材料：${item.materials.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function embedBatch(texts) {
  const res = await fetch('https://api.siliconflow.cn/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: 'BAAI/bge-m3',
      input: texts,
      encoding_format: 'float',
    }),
  });

  if (!res.ok) {
    console.error(`❌ embedding 接口返回 HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  const data = await res.json();
  // 按 index 排序，保证和输入顺序一致
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function main() {
  if (!fs.existsSync(ITEMS_PATH)) {
    console.error(`❌ 找不到 ${ITEMS_PATH}`);
    console.error('   请确认 A 已经把数据放到 data/ich-items.json');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));
  console.log(`📚 读到 ${items.length} 条非遗档案`);

  const chunks = items.map(toChunk);
  console.log('⏳ 正在生成向量（调用 BAAI/bge-m3）...');

  const vectors = await embedBatch(chunks);

  console.log(`✅ 拿到 ${vectors.length} 个向量，每个 ${vectors[0].length} 维`);

  const payload = items.map((item, i) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    region: item.region,
    text: chunks[i],
    vector: vectors[i],
  }));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`💾 已保存到 ${OUT_PATH}`);
  console.log('\n下一步：运行  node --env-file=.env rag/search.js "刺绣用什么线"');
}

main().catch((e) => {
  console.error('\n💥 出错：', e.message);
  console.error('   如果是 fetch failed，检查网络或代理');
});

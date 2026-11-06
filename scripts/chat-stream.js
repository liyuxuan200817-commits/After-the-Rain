/**
 * 流式调用 —— 像 ChatGPT 那样一个字一个字往外蹦
 * 这才是传智杯作品里真正要的效果
 * 运行：node --env-file=.env chat-stream.js
 */

const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY || API_KEY.includes('xxxx')) {
  console.error('\n❌ 请先在 .env 里填入真实的 DEEPSEEK_API_KEY\n');
  process.exit(1);
}

async function main() {
  const messages = [
    { role: 'system', content: '你是一个耐心的编程助教。' },
    { role: 'user',   content: '用大约 150 字介绍什么是向量数据库，以及它在 RAG 里的作用。' },
  ];

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      stream: true,          // ★ 关键：开启流式
    }),
  });

  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}`);
    console.error(await res.text());
    return;
  }

  // ---------- 逐块读取响应 ----------
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let fullText = '';
  let firstChunkAt = 0;
  const started = Date.now();

  process.stdout.write('✅ 回答：\n\n');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (!firstChunkAt) firstChunkAt = Date.now();
    buffer += decoder.decode(value, { stream: true });

    // SSE 格式：每行以 "data: " 开头，多条数据以换行分隔
    const lines = buffer.split('\n');
    buffer = lines.pop();            // 最后一行可能不完整，留到下一轮

    for (const line of lines) {
      const text = line.trim();
      if (!text.startsWith('data:')) continue;

      const payload = text.slice(5).trim();
      if (payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          process.stdout.write(delta);   // ★ 边收边打印 = 打字机效果
          fullText += delta;
        }
      } catch {
        // 个别分片不完整，忽略即可
      }
    }
  }

  const total = Date.now() - started;

  console.log('\n\n' + '─'.repeat(50));
  console.log(`⏱  首字延迟：${firstChunkAt - started} ms   （这就是"感觉快"的关键）`);
  console.log(`⏱  总耗时  ：${total} ms`);
  console.log(`📝 总字数  ：${fullText.length}`);
  console.log('─'.repeat(50));
  console.log('\n💡 这段代码就是作品里"流式对话"的核心逻辑，前端换成 AI SDK 的 useChat 即可。');
}

main().catch((e) => {
  console.error('\n💥 出错：', e.message);
});

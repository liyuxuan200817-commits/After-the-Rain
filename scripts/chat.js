/**
 * 非流式调用 —— 等 AI 全部想完，一次性输出
 * 运行：node --env-file=.env chat.js
 */

const API_KEY = process.env.DEEPSEEK_API_KEY;

// ---------- 1. 先检查 Key 有没有填 ----------
if (!API_KEY || API_KEY.includes('xxxx')) {
  console.error('\n❌ 没有检测到有效的 API Key\n');
  console.error('   请打开当前目录的 .env 文件，把这一行改成你的真实 Key：');
  console.error('   DEEPSEEK_API_KEY=sk-你的真实Key\n');
  console.error('   获取地址：https://platform.deepseek.com/api_keys\n');
  process.exit(1);
}

async function main() {
  const messages = [
    { role: 'system', content: '你是一个耐心的编程助教，回答简洁、给例子。' },
    { role: 'user',   content: '用三句话解释什么是 RAG（检索增强生成）。' },
  ];

  console.log('📤 提问：', messages[1].content);
  console.log('⏳ 等待回答...\n');

  const started = Date.now();

  // ---------- 2. 发请求 ----------
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      stream: false,        // 非流式
      temperature: 0.7,     // 0=稳定保守，1=发散有创意
    }),
  });

  // ---------- 3. 处理错误（别跳过，网络问题很常见）----------
  if (!res.ok) {
    console.error(`❌ 请求失败，HTTP ${res.status}`);
    console.error(await res.text());
    if (res.status === 401) console.error('→ Key 无效或已过期，检查 .env');
    if (res.status === 402) console.error('→ 账户余额不足，去充值');
    if (res.status === 429) console.error('→ 请求太频繁，等几秒再试');
    return;
  }

  const data = await res.json();
  const answer = data.choices[0].message.content;
  const ms = Date.now() - started;

  console.log('✅ 回答：\n');
  console.log(answer);

  console.log('\n' + '─'.repeat(50));
  console.log(`⏱  耗时：${ms} ms`);
  console.log(`🔢 用量：输入 ${data.usage.prompt_tokens} tokens，` +
              `输出 ${data.usage.completion_tokens} tokens`);
  console.log('─'.repeat(50));
}

main().catch((e) => {
  console.error('\n💥 程序出错：', e.message);
  console.error('   如果是 fetch failed，检查网络能否访问 api.deepseek.com');
});

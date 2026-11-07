/**
 * 生成"单文件 HTML 版"作品
 *
 * 为什么需要：Next.js 版本必须跑服务端。但有些场合（给老师看、离线演示）
 * 需要双击就能用。经实测，DeepSeek 与硅基流动都支持 CORS，
 * 因此可以让浏览器直接调接口，做成零依赖的单文件。
 *
 * ⚠️ 安全提示：单文件里内嵌了 API Key，只能本地自用，绝不能公开上传。
 *
 * 用法：node --env-file=.env scripts/build-standalone.js
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const getKey = (name) => (env.match(new RegExp(`${name}=(sk-\\S+)`)) || [])[1] || "";

const DS_KEY = getKey("DEEPSEEK_API_KEY");
const SF_KEY = getKey("SILICONFLOW_API_KEY");

if (!DS_KEY || !SF_KEY) {
  console.error("❌ .env 里缺少 Key");
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "ich-items.json"), "utf8"));
const vectors = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vectors.json"), "utf8"));

// 只保留检索需要的字段，压缩体积
const store = vectors.map((v) => ({
  name: v.name,
  school: v.school,
  region: v.region,
  text: v.text,
  vector: v.vector.map((x) => Math.round(x * 1e4) / 1e4), // 降精度省体积
}));

const gallery = items.map((it) => ({
  id: it.id,
  name: it.name,
  school: it.school,
  category: it.category,
  region: it.region,
  style: it.style || "",
  themes: it.themes || [],
}));

const PROFILES = `【杨柳青】
技法：半印半绘——木版只印墨线轮廓，大面积色彩靠手工敷彩，人物面部有肉色晕染和开脸，能看到明显手绘笔触
色彩：雅致柔和，粉红、湖蓝、藕荷等中间色多，对比不强烈
线条：细而匀
题材：仕女、胖娃娃、戏曲故事、吉祥图案
观感：接近工笔画，人物面部细腻

【桃花坞】
技法：一版一色纯套印，无手绘痕迹，色块边界清晰
色彩：清丽偏冷，蓝绿紫较多，对比不强烈
线条：刻工精细，线条流畅如刀刻
题材：戏曲故事、市井生活、仕女
观感：构图疏朗，留白较多，常见大段题字

【杨家埠】
技法：纯木版套色，绝无手绘
色彩：极浓烈——大红、大绿、亮黄、紫并置，撞色强烈
线条：粗犷简练，以块面为主
题材：门神、财神、灶王、吉祥娃娃
观感：满构图，几乎不留白

【朱仙镇】
技法：纯木版套色
色彩：厚重沉稳偏暗，红青黄为主但不艳丽
线条：最粗犷有力如铁线，人物造型古拙，头大、五官高度简化
题材：几乎全是门神
观感：严格对称构图

【绵竹】
技法：以手工彩绘为主——先印墨线再大面积手绘，笔触自由
色彩：明快通透，大红大绿但不厚重
线条：粗细变化适中，有写意感
题材：门神、戏曲故事、民间传说
观感：人物灵动

【武强】
技法：纯木版套色
色彩：鲜艳但比杨家埠素净，红黄蓝为主
线条：简洁传神
题材：农事生活场景（耕作、纺织）、节令习俗，乡土气息极浓；也有门神
观感：朴素接地气

【佛山】
技法：大红底 + 手工描金——底色是大红（不是白纸底），再套印其他色，最后金线勾勒
色彩：浓重的红金调，非常华丽
线条：有金线勾勒
题材：门神、神像
观感：红底描金，是北方年画都没有的独有标志`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>年画档案 · AfterRain（单文件版）</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--red:#a62b1f;--gold:#d4af37;--paper:#faf8f4;--ink:#24282f;--grey:#78716c;--line:#e7e5e4}
body{font-family:"Microsoft YaHei","PingFang SC",-apple-system,sans-serif;background:var(--paper);color:var(--ink);line-height:1.75;padding:0 0 60px}
.warn{background:#a62b1f;color:#fff;font-size:13px;padding:9px 16px;text-align:center}
.warn b{color:#ffd88a}
.wrap{max-width:1000px;margin:0 auto;padding:0 24px}
header{padding:36px 0 22px;border-bottom:2px solid var(--red);margin-bottom:28px}
h1{font-size:28px;color:var(--red);font-weight:700;display:inline}
.tag{font-size:13px;color:#a8a29e;margin-left:10px}
.desc{font-size:14px;color:var(--grey);margin-top:10px;line-height:1.8}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:22px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
h2{font-size:17px;color:var(--red);margin-bottom:4px;display:flex;align-items:center;gap:8px}
.hint{font-size:12.5px;color:#a8a29e;margin-bottom:14px}
textarea,input[type=text]{width:100%;border:1px solid #d6d3d1;border-radius:9px;padding:11px 13px;font-size:14px;font-family:inherit;outline:none;resize:vertical}
textarea:focus,input[type=text]:focus{border-color:var(--red)}
.row{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
button{background:var(--red);color:#fff;border:none;border-radius:9px;padding:11px 22px;font-size:14px;cursor:pointer;font-family:inherit}
button:disabled{opacity:.4;cursor:not-allowed}
button.ghost{background:#fff;color:var(--grey);border:1px solid #d6d3d1}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{background:#f5f5f4;border:1px solid var(--line);border-radius:20px;padding:5px 13px;font-size:12.5px;color:#57534e;cursor:pointer}
.chip:hover{border-color:var(--red);color:var(--red)}
.out{background:#fafaf9;border-radius:11px;padding:16px;margin-top:14px;font-size:14px;white-space:pre-wrap;line-height:1.85;min-height:0}
.meta{font-size:12.5px;color:var(--grey);margin-top:10px}
.err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:11px;padding:14px;margin-top:14px;font-size:13.5px}
.up{border:2px dashed #d6d3d1;border-radius:13px;padding:44px 20px;text-align:center;cursor:pointer;transition:.15s}
.up:hover{border-color:var(--red);background:#fdfcfb}
.up .ico{font-size:36px}
.up .t1{font-size:14px;font-weight:600;margin-top:10px}
.up .t2{font-size:12.5px;color:#a8a29e;margin-top:4px}
#preview{max-width:200px;border-radius:10px;border:1px solid var(--line);display:none}
.cand{border:1px solid var(--line);border-radius:9px;padding:9px 13px;margin-top:8px;font-size:13.5px;background:#fafaf9}
.cand.top{border-color:#e8c4c7;background:#fdf6f6}
.cand .sc{font-weight:700;color:var(--red)}
.conf{font-size:11px;border-radius:4px;padding:1px 6px;margin-left:6px}
.exc{font-size:12.5px;color:#a8a29e;margin-top:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.gcard{border:1px solid var(--line);border-radius:11px;padding:15px;background:#fff;transition:.15s}
.gcard:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(166,43,31,.1);border-color:var(--red)}
.gcard h3{font-size:15px;margin-bottom:6px}
.gcard .s{display:inline-block;background:#fdf6e3;color:#8a6a12;font-size:11px;border-radius:4px;padding:1px 7px;margin-left:6px}
.gcard .m{font-size:12px;color:#a8a29e;margin-top:4px}
.gcard .st{font-size:12px;color:var(--grey);margin-top:8px;line-height:1.6}
.themes{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}
.themes span{background:#f5f5f4;color:#78716c;font-size:11px;border-radius:4px;padding:1px 7px}
.spin{display:inline-block;width:14px;height:14px;border:2px solid #d6d3d1;border-top-color:var(--red);border-radius:50%;animation:sp .8s linear infinite;vertical-align:-2px;margin-right:7px}
@keyframes sp{to{transform:rotate(360deg)}}
footer{text-align:center;font-size:12.5px;color:#a8a29e;padding-top:26px;border-top:1px solid var(--line);margin-top:34px}
code{background:#f0eee9;padding:1px 5px;border-radius:3px;font-size:12.5px}
</style>
</head>
<body>

<div class="warn">
  ⚠️ <b>单文件演示版</b> —— API Key 已内嵌在本文件中，<b>仅供本地自用，请勿上传或分享</b>
</div>

<div class="wrap">
  <header>
    <h1>年画档案</h1><span class="tag">AfterRain · 雨后天晴，伴你而行</span>
    <div class="desc">
      中国木版年画的数字馆藏助手。可以提问，也可以上传照片让 AI 讲讲这幅画。<br>
      AI 只依据馆藏资料作答并注明来源，查不到就明说。
    </div>
  </header>

  <!-- 看图讲年画 -->
  <div class="card">
    <h2>🖼️ 看图讲年画</h2>
    <div class="hint">上传一张年画照片，AI 讲讲画的是什么、有什么寓意</div>
    <div class="up" id="dropArea">
      <div class="ico">📤</div>
      <div class="t1">点击选择图片</div>
      <div class="t2">支持 jpg / png / webp，会自动压缩后上传</div>
      <input type="file" id="fileInput" accept="image/*" hidden>
    </div>
    <div style="display:none;margin-top:16px" id="imgBox">
      <img id="preview" alt="上传的年画">
      <button class="ghost" id="resetBtn" style="margin-left:12px;padding:7px 14px;font-size:12.5px">换一张</button>
    </div>
    <div id="stageBox" style="display:none;margin-top:14px;font-size:13.5px;color:#57534e"></div>
    <div id="judgeBox" style="display:none;margin-top:14px"></div>
    <div id="interpBox" style="display:none;margin-top:14px">
      <div style="font-size:12.5px;font-weight:600;color:var(--grey);margin-bottom:8px">AI 讲解</div>
      <div class="out" id="interpOut"></div>
    </div>
    <div id="descBox" style="display:none;margin-top:12px">
      <details><summary style="cursor:pointer;font-size:12.5px;font-weight:600;color:var(--grey)">AI 看到的画面（技术细节）</summary>
      <div class="out" id="descOut" style="font-size:12.5px"></div></details>
    </div>
    <div class="err" id="upErr" style="display:none"></div>
  </div>

  <!-- 问答 -->
  <div class="card">
    <h2>🏮 问一问馆藏</h2>
    <div class="hint">AI 会先检索档案，再回答，并注明出处</div>
    <input type="text" id="q" placeholder="比如：杨柳青年画是怎么画出来的？">
    <div class="row"><button id="askBtn">提问</button></div>
    <div class="chips" id="examples"></div>
    <div id="hitBox" style="display:none;margin-top:14px;font-size:12.5px;color:var(--grey)"></div>
    <div class="out" id="ansOut" style="display:none"></div>
    <div class="err" id="chatErr" style="display:none"></div>
  </div>

  <!-- 馆藏 -->
  <div class="card">
    <h2>📜 馆藏档案</h2>
    <div class="hint" id="galHint"></div>
    <div class="grid" id="gallery"></div>
  </div>

  <footer>
    2026 第九届传智杯 · AI WEB 网页开发挑战赛 · AfterRain 队<br>
    数据为示例内容，正式提交前需用权威来源替换
  </footer>
</div>

<script>
/* ==================== 配置 ==================== */
const CONFIG = {
  DEEPSEEK_KEY: ${JSON.stringify(DS_KEY)},
  SILICONFLOW_KEY: ${JSON.stringify(SF_KEY)},
  DS_MODEL: "deepseek-chat",
  EMBED_MODEL: "BAAI/bge-m3",
  VISION_MODEL: "Qwen/Qwen3-VL-8B-Instruct"
};

/* ==================== 数据 ==================== */
const STORE = ${JSON.stringify(store)};
const GALLERY = ${JSON.stringify(gallery)};
const PROFILES = ${JSON.stringify(PROFILES)};

/* ==================== 工具 ==================== */
const $ = (id) => document.getElementById(id);

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(text) {
  const r = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.SILICONFLOW_KEY },
    body: JSON.stringify({ model: CONFIG.EMBED_MODEL, input: [text], encoding_format: "float" })
  });
  if (!r.ok) throw new Error("向量化失败 HTTP " + r.status + ": " + (await r.text()).slice(0,150));
  const j = await r.json();
  return j.data[0].embedding;
}

function search(qv, topK) {
  return STORE.map(s => ({ ...s, score: cosine(qv, s.vector) }))
    .sort((a,b) => b.score - a.score).slice(0, topK);
}

/** 通用流式调用：把 SSE 转成回调 */
async function streamChat(messages, onDelta) {
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.DEEPSEEK_KEY },
    body: JSON.stringify({ model: CONFIG.DS_MODEL, messages, stream: true, temperature: 0.3 })
  });
  if (!r.ok) throw new Error("对话失败 HTTP " + r.status + ": " + (await r.text()).slice(0,150));

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (p === "[DONE]") continue;
      try {
        const j = JSON.parse(p);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) onDelta(d);
      } catch (e) {}
    }
  }
}

/** 浏览器端压缩 */
async function compressImage(file, maxSize = 1024, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,w,h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return cv.toDataURL("image/jpeg", quality);
}

/* ==================== 馆藏展示 ==================== */
(function renderGallery() {
  const schools = new Set(GALLERY.map(g => g.school).filter(s => s && s !== "通用"));
  $("galHint").textContent = "收录 " + schools.size + " 大流派，" + GALLERY.length + " 条档案";
  $("gallery").innerHTML = GALLERY.map(g => \`
    <div class="gcard">
      <h3>\${g.name}<span class="s">\${g.school || ""}</span></h3>
      <div class="m">\${g.category || ""} · \${g.region || ""}</div>
      \${g.style ? '<div class="st">' + g.style + '</div>' : ''}
      \${g.themes && g.themes.length ? '<div class="themes">' + g.themes.slice(0,3).map(t=>'<span>'+t+'</span>').join('') + '</div>' : ''}
    </div>\`).join("");
})();

/* ==================== 问答 ==================== */
const EXAMPLES = ["杨柳青和杨家埠有什么区别", "杨柳青年画是怎么画出来的", "连年有余是什么寓意", "年画的创始人是谁"];

(function renderExamples() {
  $("examples").innerHTML = EXAMPLES.map(e => '<span class="chip">' + e + '</span>').join("");
  $("examples").querySelectorAll(".chip").forEach(el => {
    el.onclick = () => { $("q").value = el.textContent; ask(); };
  });
})();

let asking = false;

async function ask() {
  const q = $("q").value.trim();
  if (!q || asking) return;
  asking = true;
  $("askBtn").disabled = true;
  $("chatErr").style.display = "none";
  $("ansOut").style.display = "block";
  $("ansOut").innerHTML = '<span class="spin"></span>正在检索馆藏…';
  $("hitBox").style.display = "none";

  try {
    const qv = await embed(q);
    const hits = search(qv, 2);

    $("hitBox").style.display = "block";
    $("hitBox").innerHTML = "命中馆藏：" + hits.map(h => '<code>' + h.name + '</code>').join(" ");

    const ctx = hits.map((h,i) => "【资料" + (i+1) + "：" + h.name + "】\\n" + h.text + "\\n来源：" + h.region).join("\\n\\n");
    const messages = [
      { role: "system", content: "你是\\"雨后天晴·年画档案助手\\"，只依据提供的馆藏资料回答问题。\\n\\n严格规则：\\n1. 只能使用【馆藏资料】里的内容回答，不许编造。\\n2. 如果资料里没有答案，必须明确回复：\\"馆藏未收录相关内容。\\"并建议用户换个问法。\\n3. 回答最后必须单独一行标注来源，格式：—— 出自《档案名》馆藏档案\\n4. 语言亲切简洁，面向普通观众。" },
      { role: "user", content: "【馆藏资料】\\n" + ctx + "\\n\\n【用户问题】\\n" + q }
    ];

    let acc = "";
    $("ansOut").innerHTML = "";
    await streamChat(messages, (d) => { acc += d; $("ansOut").textContent = acc; });
  } catch (e) {
    $("chatErr").style.display = "block";
    $("chatErr").textContent = "出错了：" + e.message;
    $("ansOut").style.display = "none";
  } finally {
    asking = false;
    $("askBtn").disabled = false;
  }
}

$("askBtn").onclick = ask;
$("q").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) ask(); });

/* ==================== 看图讲年画 ==================== */
const dropArea = $("dropArea");
dropArea.onclick = () => $("fileInput").click();
dropArea.ondragover = e => e.preventDefault();
dropArea.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f); };
$("fileInput").onchange = e => { const f = e.target.files[0]; if (f) handleImage(f); };
$("resetBtn").onclick = () => {
  $("imgBox").style.display = "none";
  $("preview").style.display = "none";
  $("preview").src = "";
  ["judgeBox","interpBox","descBox","upErr"].forEach(id => $(id).style.display = "none");
  $("stageBox").style.display = "none";
  $("fileInput").value = "";
  dropArea.style.display = "block";
};

let imgBusy = false;

async function handleImage(file) {
  if (imgBusy) return;
  if (!file.type.startsWith("image/")) { alert("请选择图片文件"); return; }
  imgBusy = true;

  $("upErr").style.display = "none";
  ["judgeBox","interpBox","descBox"].forEach(id => $(id).style.display = "none");
  $("stageBox").style.display = "block";
  dropArea.style.display = "none";
  $("imgBox").style.display = "block";
  $("preview").style.display = "inline-block";

  const t0 = Date.now();

  try {
    $("stageBox").innerHTML = '<span class="spin"></span>正在压缩图片…';
    const dataUrl = await compressImage(file);
    $("preview").src = dataUrl;

    // ① 视觉描述
    $("stageBox").innerHTML = '<span class="spin"></span>正在看图，提取画面特征…';
    const r1 = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.SILICONFLOW_KEY },
      body: JSON.stringify({
        model: CONFIG.VISION_MODEL, temperature: 0.1, max_tokens: 700,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "请客观描述这幅年画的视觉特征。\\n\\n⚠️ 重要提醒：木版套色印刷因为手工刷色和套版对位，天然会有套印略微错位、色块边缘不齐、颜料浓淡不均、局部渗化，这些是印刷工艺的正常痕迹，绝不能当成\\"手绘\\"。\\n\\n请回答：\\n1. 色彩：主色是哪几种？饱和度？对比强弱？底色是白纸还是彩色？\\n2. 线条：粗细如何？\\n3. 【关键】技法判断：有没有大面积的、有笔触感的手工敷彩或面部晕染？若为色块平涂、边界清晰（即便有不齐或渗化）→ 明确写\\"纯套色印刷，无手绘\\"；若确有人物面部晕染开脸、衣饰大面积手绘笔触 → 说明具体部位。\\n4. 题材内容\\n5. 构图：满构图还是留白多？\\n\\n只描述不下结论，150-250字。" }
        ]}]
      })
    });
    if (!r1.ok) throw new Error("看图失败 HTTP " + r1.status + "（可能是余额不足）");
    const j1 = await r1.json();
    const description = j1.choices[0].message.content;

    $("descBox").style.display = "block";
    $("descOut").textContent = description;

    // ② 流派判断
    $("stageBox").innerHTML = '<span class="spin"></span>正在对照七流派鉴别要点判断…';
    const r2 = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.DEEPSEEK_KEY },
      body: JSON.stringify({
        model: CONFIG.DS_MODEL, temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是中国木版年画鉴定专家。用户提供一段画面描述，你要严格对照七个流派的鉴别要点判断最可能属于哪个流派。\\n\\n核心原则：\\n1. 只依据描述中【实际出现】的信息判断，不许凭名气猜测。\\n2. 特别注意技法：套印不齐、边缘不齐、浓淡不均是印刷正常痕迹，绝不能当\\"手绘\\"。只有大面积有笔触感的敷彩和面部晕染，才算半印半绘。\\n3. 信息不足时 confidence 填\\"低\\"。\\n4. 必须给出可核查的理由。\\n\\n只输出 JSON。" },
          { role: "user", content: "【画面描述】\\n" + description + "\\n\\n【七个流派的鉴别要点】\\n" + PROFILES + "\\n\\n【输出格式（严格 JSON）】\\n{\\"ranked\\":[{\\"school\\":\\"流派名\\",\\"confidence\\":\\"高|中|低\\",\\"reason\\":\\"20-40字依据\\"}],\\"excluded\\":[{\\"school\\":\\"流派名\\",\\"reason\\":\\"15-30字排除理由\\"}]}\\n\\nranked 最多3个，按可能性排序；excluded 最多3个；school 必须是这七个之一：杨柳青、桃花坞、杨家埠、朱仙镇、绵竹、武强、佛山。" }
        ]
      })
    });
    if (!r2.ok) throw new Error("判断失败 HTTP " + r2.status);
    const j2 = await r2.json();
    const judged = JSON.parse(j2.choices[0].message.content);

    const confColor = c => c === "高" ? ["#dcfce7","#166534"] : c === "中" ? ["#fdf6e3","#8a6a12"] : ["#fef3c7","#9a5b00"];
    $("judgeBox").style.display = "block";
    $("judgeBox").innerHTML = '<div style="font-size:12.5px;font-weight:600;color:var(--grey);margin-bottom:8px">流派判断（对照七流派鉴别要点，按可能性排序）</div>' +
      (judged.ranked || []).map((r, i) => {
        const [bg, fg] = confColor(r.confidence);
        return '<div class="cand' + (i===0?' top':'') + '"><span class="sc">' + (i+1) + '. ' + r.school + '</span>' +
          '<span class="conf" style="background:' + bg + ';color:' + fg + '">把握' + r.confidence + '</span>' +
          '<div style="color:#78716c;margin-top:4px;font-size:12.5px">' + r.reason + '</div></div>';
      }).join("") +
      (judged.excluded && judged.excluded.length ? '<div class="exc">已排除：' + judged.excluded.map(e => e.school).join("、") + '</div>' : '');

    // ③ 生成讲解
    $("stageBox").innerHTML = '<span class="spin"></span>正在撰写讲解…';
    const candText = (judged.ranked || []).map((r,i) => "【参考" + (i+1) + "】" + r.school + "流派，把握程度：" + r.confidence + "\\n    判断依据：" + r.reason).join("\\n\\n");
    const detail = STORE.filter(s => (judged.ranked||[]).some(r => r.school === s.school)).map(s => s.text).join("\\n\\n");

    $("interpBox").style.display = "block";
    let acc = "";
    $("interpOut").textContent = "";
    await streamChat([
      { role: "system", content: "你是\\"雨后天晴·年画档案助手\\"的讲解员。用户上传了一张年画照片，系统已经做了两件事：① 视觉模型客观描述了画面；② 另一套流程对照七个流派要点给出了候选流派及理由。\\n\\n请据此写讲解，严格按结构：\\n\\n【这幅画的是什么】\\n依据画面描述，说清题材与内容。\\n\\n【寓意】\\n解读吉祥寓意，说明是谐音还是典故。\\n\\n【可能属于的流派】\\n引用候选排名和判断依据，用\\"可能是……也可能是……\\"的措辞。\\n**不许直接断言属于某个流派**。\\n\\n【温馨提示】\\n一句话提醒：准确鉴定需专业机构结合实物与文献判断。\\n\\n硬性要求：只能使用提供的描述和资料，不许编造；资料没有就说\\"馆藏未收录相关条目\\"；语言亲切通俗，300-450字。" },
      { role: "user", content: "【画面描述】\\n" + description + "\\n\\n【流派判断候选】\\n" + candText + "\\n\\n【档案正文】\\n" + detail }
    ], (d) => { acc += d; $("interpOut").textContent = acc; });

    $("stageBox").style.display = "none";
    $("judgeBox").insertAdjacentHTML("beforeend", '<div class="meta">总耗时 ' + ((Date.now()-t0)/1000).toFixed(1) + ' 秒</div>');
  } catch (e) {
    $("stageBox").style.display = "none";
    $("upErr").style.display = "block";
    $("upErr").textContent = "出错了：" + e.message;
  } finally {
    imgBusy = false;
  }
}
</script>
</body>
</html>`;

const out = path.join(ROOT, "年画档案-单文件版.html");
fs.writeFileSync(out, html, "utf8");
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`✅ 已生成: ${out}`);
console.log(`   大小: ${kb} KB`);
console.log(`   档案: ${store.length} 条（含向量）`);
console.log(`   双击即可在浏览器打开`);

# 前端接手说明（给 C）

> 项目：年画档案 · After-the-Rain
> 代码仓库：https://github.com/liyuxuan200817-commits/After-the-Rain
> 线上地址：https://after-the-rain-git-main-liyuxuan200817-2433.vercel.app

---

## 一、一句话说清现在的状况

**后端和 AI 全部做完了，能跑通、能部署。缺的是页面设计和交互体验。**

你已经不需要碰任何 AI 代码，只要做「界面」这一层。

---

## 二、怎么跑起来（10 分钟）

### 1. 克隆项目

```powershell
cd D:\dev\projects
git clone https://github.com/liyuxuan200817-commits/After-the-Rain.git after-the-rain
cd after-the-rain
```

> ⚠️ 如果提示 `Repository not found`，先开梯子（GitHub 在国内不稳定）。

### 2. 安装依赖

```powershell
npm install
```

约 3–5 分钟，会下载 300MB 左右。

### 3. 配置密钥

找队长要两个 Key，建一个 `.env` 文件（放在项目根目录）：

```ini
DEEPSEEK_API_KEY=sk-找队长要
SILICONFLOW_API_KEY=sk-找队长要
```

> ⚠️ `.env` 已被 gitignore，**不会提交**。不要把它发给别人，也不要截图外传。

### 4. 启动

```powershell
npm run dev
```

浏览器打开 `http://localhost:3000`。

**能看到页面、能问答、能上传图片 = 环境通了。**

### 5. 验证环境是否真的正常

浏览器打开：

```
http://localhost:3000/api/health?deep=1
```

看到 `"ok": true` 就说明 Key 都有效、余额够。

---

## 三、已经做好的部分（**不要重做**）

| 已完成 | 位置 | 说明 |
|---|---|---|
| **RAG 检索问答** | `/api/chat` | 流式输出 + 注明出处 + 查不到会拒答 |
| **视觉描述** | `/api/describe` | 图片 → 画面客观描述 |
| **流派判断** | `/api/judge` | 对照七流派鉴别要点，输出候选+理由 |
| **讲解生成** | `/api/compose` | 流式生成讲解 |
| **环境自检** | `/api/health` | `?deep=1` 会真实调用验证 |
| **8 条年画档案** | `data/ich-items.json` | 含向量索引 `data/vectors.json` |
| **基础页面** | `app/page.tsx` | 能用的版本，你要在此基础上重做 |

这些都在服务端，**你完全不用改**。

---

## 四、你要做的（你的地盘）

### 主要任务

| 优先级 | 任务 | 文件 |
|---|---|---|
| **P0** | 首页重做成「七流派画廊」 | `app/page.tsx` |
| **P0** | 新增详情页（点卡片看单条档案） | `app/collection/[id]/page.tsx`（新建） |
| **P0** | 问答组件美化 + 引用高亮可点击 | `app/ChatBox.tsx` |
| **P1** | 上传组件美化 + 加载态优化 | `app/UploadPanel.tsx` |
| **P1** | 移动端适配 | 全局 |
| **P2** | 动画、过渡、骨架屏 | 全局 |

### 你的文件边界（重要）

```
✅ 你可以改：
   app/page.tsx
   app/ChatBox.tsx
   app/UploadPanel.tsx
   app/layout.tsx
   app/globals.css
   app/collection/  ← 可以新建

❌ 不要动：
   lib/          ← AI 核心逻辑
   app/api/      ← 接口实现
   data/         ← 数据
   scripts/      ← 工具脚本
```

**只改自己目录的文件，别碰别人的**，不然合并会冲突。

---

## 五、接口文档（你要调的）

### ① `POST /api/chat` — 问答

```typescript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "杨柳青年画怎么画出来的" }),
});

// 响应是 纯文本流（不是 JSON）
const hits = decodeURIComponent(res.headers.get("X-Hits") || "").split(",");
// hits = ["杨柳青木版年画", "杨家埠木版年画"]  ← 命中的档案名，可以做成可点击标签

const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setAnswer(prev => prev + decoder.decode(value, { stream: true }));
}
```

### ② `POST /api/describe` → `POST /api/judge` → `POST /api/compose` — 看图讲年画

三步必须按顺序调：

```typescript
// 第一步：图片 → 画面描述
const r1 = await fetch("/api/describe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image: dataUrl }), // "data:image/jpeg;base64,..."
});
const { description } = await r1.json();

// 第二步：描述 → 流派候选
const r2 = await fetch("/api/judge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description }),
});
const { candidates, excluded } = await r2.json();
// candidates: [{ name, school, region, confidence: "高"|"中"|"低", reason }]
// excluded:   [{ school, reason }]

// 第三步：候选 → 讲解（流式）
const r3 = await fetch("/api/compose", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description, candidates }),
});
// 同样是纯文本流，用 reader 逐段读
```

**每一步都建议显示不同的加载文案**，用户等 10 秒会焦虑：

| 步骤 | 耗时 | 建议文案 |
|---|---|---|
| describe | 5–13 s | 正在看图，提取画面特征… |
| judge | 2–3 s | 正在对照七流派鉴别要点判断… |
| compose | 3–6 s | 正在撰写讲解… |

### ③ `GET /api/health` — 自检

```typescript
// ?deep=1 会真实调用接口验证 Key 和余额（约 2 秒，会产生极少费用）
const { ok, env, vectorCount, hints } = await (await fetch("/api/health?deep=1")).json();
```

---

## 六、设计规范

### 配色（已在 `app/globals.css` 定义好变量）

| 用途 | 色值 | 变量 |
|---|---|---|
| 主色 · 朱红 | `#A62B1F` | `--zhuhong` |
| 辅色 · 金 | `#D4AF37` | `--jin` |
| 背景 · 宣纸白 | `#FAF8F4` | `--xuan` |
| 文字 · 墨 | `#24282F` | `--mo` |

### 风格要求

- **底色用宣纸白，不要用纯白** —— 纯白太“科技感”，年画需要纸的质感
- **标题可以用衬线字体**（宋体/思源宋体），正文用无衬线
- **留白要够** —— 年画本身信息密集，界面要透气
- 卡片圆角 8–12px，阴影要淡（`0 1px 3px rgba(0,0,0,.04)`）

### 参考现有代码

`app/page.tsx` 已经有基础结构（顶部标题 + 问答区 + 馆藏卡片），你可以在此基础上重做。

---

## 七、验收标准

做完了对着这张表自检：

- [ ] `npm run dev` 能启动，页面正常显示
- [ ] 首页能看到 8 条年画档案
- [ ] 点卡片能进详情页
- [ ] 问答能流式输出，且末尾有出处
- [ ] 上传图片能走完三步，显示流派候选和讲解
- [ ] 手机上打开不崩
- [ ] `npm run build` 能通过（部署前必须）

---

## 八、时间要求

| 时间 | 交付 |
|---|---|
| **11-11** | 首页 + 详情页做完 |
| **11-12** | 问答和上传组件美化完 |
| **11-13** | `npm run build` 通过，能部署 |
| **11-15** | 录好演示视频 |

**11-12 之后不再加新功能，只修 bug。**

---

## 九、遇到问题

| 问题 | 找谁 |
|---|---|
| 接口报错、AI 不返回 | 找队长（后端问题） |
| 页面样式、交互 | 你自己定 |
| Git 推送失败 | 找队长（`push.ps1` 能自动处理代理） |
| 环境跑不起来 | 把报错发给队长 |

---

## 十、一句话

**你只需要做「界面好看、交互顺畅」，AI 和内容都已经能用了。**

现在页面是“能用但不美”的状态，你的工作就是让它变成**评委打开会想多看一眼**的作品。

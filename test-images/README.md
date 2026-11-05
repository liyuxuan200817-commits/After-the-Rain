# 年画测试图片放这里

## 命名规则（重要）

**把流派写进文件名**，脚本才能自动判断认对没认对。

✅ 正确命名：

```
杨柳青-门神.jpg
杨柳青-仕女.jpg
桃花坞-戏曲故事.jpg
杨家埠-财神.jpg
朱仙镇-门神.jpg
绵竹-门神.jpg
武强-吉祥图案.jpg
佛山-神像.jpg
```

❌ 不要这样：

```
IMG_1234.jpg          ← 看不出流派
微信图片_2026.jpg      ← 脚本无法比对
1.jpg
```

## 一个要注意的点

命名用的流派要和图片**真实所属**一致。如果图片本身来源不明、你不确定是哪个流派，那**别猜**——
不写流派的图片，脚本只会打印 AI 的判断，不参与准确率统计（这样结果才可信）。

## 建议找多少张

| 数量 | 效果 |
|---|---|
| 3 张 | 能看出大致倾向 |
| **5–8 张** | **比较可信，推荐** |
| 10 张以上 | 最稳，但没必要 |

**每个流派至少 1 张，覆盖 4 个以上流派**，这样能看出模型是不是只会认某一个流派。

## 图片要求

- 格式：jpg / png / webp
- 大小：**4MB 以内**（超了接口会拒绝）
- 内容：**纯年画本体**最好，不要带网页界面、水印、边框截图
- 清晰度：能看清线条和色彩即可，不需要高清扫描

## 从哪找

1. **中国非物质文化遗产网** `ihchina.cn` —— 最权威，条目里带图
2. 各年画博物馆官网（杨柳青、桃花坞、杨家埠）
3. 浏览器直接搜「杨柳青 年画 门神」，右键另存

> 用于技术验证阶段，图片版权不用太紧张；正式提交作品时要补图源说明。

## 放好后运行

```powershell
cd D:\dev\projects\deepseek-test
node --env-file=.env scripts/verify-vision.js test-images
```

如果想换模型试试：

```powershell
$env:VISION_MODEL="Qwen/Qwen3-VL-8B-Instruct"
node --env-file=.env scripts/verify-vision.js test-images
```

可选的视觉模型（已验证可用）：

```
Qwen/Qwen3-VL-32B-Instruct      ← 默认，质量和速度平衡
Qwen/Qwen3-VL-32B-Thinking      ← 会先思考，慢但可能更准
Qwen/Qwen3-VL-30B-A3B-Instruct  ← 更轻量
Qwen/Qwen3-VL-8B-Instruct       ← 最快
PaddlePaddle/PaddleOCR-VL-1.5   ← 偏 OCR，不适合鉴定
```

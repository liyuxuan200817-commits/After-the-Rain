# DeepSeek 接口测试

零依赖，只用 Node.js 自带的 `fetch`。

## 一、填 Key

打开 `.env`，把这一行改成你的真实 Key：

```
DEEPSEEK_API_KEY=sk-你的真实Key
```

Key 获取地址：https://platform.deepseek.com/api_keys

## 二、运行

```powershell
cd D:\dev\projects\deepseek-test

# 非流式（一次性输出）
node --env-file=.env chat.js

# 流式（打字机效果）
node --env-file=.env chat-stream.js
```

## 三、文件说明

| 文件 | 作用 |
|---|---|
| `chat.js` | 非流式调用，带错误处理和用量统计 |
| `chat-stream.js` | 流式调用，**这是作品里真正要的效果** |
| `.env` | 存放密钥（**已被 .gitignore 忽略，不会提交**） |
| `.env.example` | 模板，告诉队友要配哪些变量 |
| `.gitignore` | 防止密钥泄露 |

## 四、常见报错

| 状态码 | 含义 | 怎么办 |
|---|---|---|
| 401 | Key 无效 | 检查 `.env` 里有没有多余空格 |
| 402 | 余额不足 | 去平台充值 |
| 429 | 请求太频繁 | 等几秒重试 |
| fetch failed | 网络不通 | 检查能否访问 api.deepseek.com |

## 五、为什么要用 `--env-file`

Node 20.6+ 内置了读取 `.env` 的功能，**不用装 dotenv 包**。
如果换成旧写法 `node chat.js`，会读不到 Key 而直接退出。

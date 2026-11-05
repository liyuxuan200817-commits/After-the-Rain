"use client";

import { useState, useRef } from "react";

const EXAMPLES = [
  "杨柳青和杨家埠有什么区别",
  "杨柳青年画是怎么画出来的",
  "连年有余是什么寓意",
  "年画的创始人是谁",
];

export default function ChatBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text || loading) return;

    setQuestion(text);
    setLoading(true);
    setAnswer("");
    setHits([]);
    setError("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: ctrl.signal,
      });

      const hitHeader = res.headers.get("X-Hits");
      if (hitHeader) {
        setHits(decodeURIComponent(hitHeader).split(",").filter(Boolean));
      }

      if (!res.ok) {
        const msg = await res.text();
        setError(msg || `请求失败 HTTP ${res.status}`);
        return;
      }
      if (!res.body) {
        setError("服务器没有返回内容流");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(`网络中断：${(e as Error).message}`);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏮</span>
        <h2 className="text-lg font-bold" style={{ color: "var(--zhuhong)" }}>
          问一问馆藏
        </h2>
        <span className="text-xs text-stone-400">
          AI 会先检索档案，再回答，并注明出处
        </span>
      </div>

      {/* 输入区 */}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) ask();
          }}
          placeholder="比如：杨柳青年画是怎么画出来的？"
          className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#A62B1F]"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="rounded-lg px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "var(--zhuhong)" }}
        >
          {loading ? "检索中…" : "提问"}
        </button>
      </div>

      {/* 示例问题 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => ask(e)}
            disabled={loading}
            className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600 hover:border-[#A62B1F] hover:text-[#A62B1F] disabled:opacity-40"
          >
            {e}
          </button>
        ))}
      </div>

      {/* 命中档案 */}
      {hits.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>命中馆藏：</span>
          {hits.map((h) => (
            <span
              key={h}
              className="rounded px-2 py-0.5"
              style={{ background: "#F7E7E8", color: "var(--zhuhong)" }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* 回答区 */}
      {(answer || loading) && (
        <div className="mt-4 rounded-xl bg-stone-50 p-5 text-sm leading-7 whitespace-pre-wrap">
          {answer ? (
            <span className={loading ? "streaming" : ""}>{answer}</span>
          ) : (
            <span className="text-stone-400">正在检索馆藏并思考…</span>
          )}
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

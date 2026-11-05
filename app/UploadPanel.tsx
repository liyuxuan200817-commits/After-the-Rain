"use client";

import { useState, useRef } from "react";

type Candidate = {
  name: string;
  school: string;
  region: string;
  score: number;
};

const DISCLAIMER =
  "本结果由 AI 基于画面描述与馆藏资料生成，仅供文化了解；准确鉴定请由专业机构结合实物与文献判断。";

/**
 * 浏览器端图片压缩
 * 手机原图常 4–8MB，Vercel 请求体上限约 4.5MB；
 * 而且图片 token 消耗与像素量正相关，压缩能显著省钱。
 */
async function compressImage(file: File, maxSize = 1024, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas，无法压缩图片");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", quality);
}

export default function UploadPanel() {
  const [preview, setPreview] = useState("");
  const [stage, setStage] = useState<"" | "compress" | "describe" | "compose">("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");
  const [elapsed, setElapsed] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = stage !== "";

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    // 重置
    setError("");
    setDescription("");
    setCandidates([]);
    setInterpretation("");
    setElapsed("");
    setStage("compress");

    try {
      // ① 压缩
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      const kb = Math.round((dataUrl.length * 3) / 4 / 1024);
      setMeta(`压缩后约 ${kb} KB`);

      // ② 看图 + 检索
      setStage("describe");
      const t0 = Date.now();
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `识别失败 HTTP ${res.status}`);
        setStage("");
        return;
      }

      setDescription(data.description);
      setCandidates(data.candidates);
      setElapsed(`看图与检索耗时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);

      // ③ 生成讲解（流式）
      setStage("compose");
      const res2 = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: data.description, candidates: data.candidates }),
      });

      if (!res2.ok || !res2.body) {
        const msg = await res2.text();
        setError(msg || `讲解生成失败 HTTP ${res2.status}`);
        setStage("");
        return;
      }

      const reader = res2.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setInterpretation(acc);
      }
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`);
    } finally {
      setStage("");
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function reset() {
    setPreview("");
    setDescription("");
    setCandidates([]);
    setInterpretation("");
    setError("");
    setMeta("");
    setElapsed("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const STAGE_TEXT: Record<string, string> = {
    compress: "正在压缩图片…",
    describe: "正在看图并检索馆藏…",
    compose: "正在撰写讲解…",
  };
  const stageText = STAGE_TEXT[stage] ?? "";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xl">🖼️</span>
        <h2 className="text-lg font-bold" style={{ color: "var(--zhuhong)" }}>
          看图讲年画
        </h2>
        <span className="text-xs text-stone-400">
          上传一张年画照片，AI 讲讲画的是什么、有什么寓意
        </span>
      </div>

      {/* 上传区 */}
      {!preview && (
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 py-12 transition hover:border-[#A62B1F] hover:bg-stone-50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <div className="text-4xl">📤</div>
          <div className="mt-3 text-sm font-medium text-stone-700">
            点击选择图片，或把图片拖到这里
          </div>
          <div className="mt-1 text-xs text-stone-400">
            支持 jpg / png / webp，会自动压缩后再上传
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </label>
      )}

      {/* 结果区 */}
      {preview && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-56 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="上传的年画"
              className="w-full rounded-lg border border-stone-200 object-cover"
            />
            <div className="mt-2 text-center text-xs text-stone-400">{meta}</div>
            <button
              onClick={reset}
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-stone-300 py-2 text-xs text-stone-600 hover:border-[#A62B1F] hover:text-[#A62B1F] disabled:opacity-40"
            >
              换一张
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {/* 进度 */}
            {stage && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-[#A62B1F]" />
                {stageText}
              </div>
            )}

            {/* 错误 */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 相近馆藏 */}
            {candidates.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-xs font-semibold text-stone-500">
                  检索到的相近馆藏
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c, i) => (
                    <span
                      key={c.name}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{
                        background: i === 0 ? "#F7E7E8" : "#F5F5F4",
                        color: i === 0 ? "var(--zhuhong)" : "#57534E",
                      }}
                    >
                      {c.name} · {Math.round(c.score * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 讲解 */}
            {(interpretation || stage === "compose") && (
              <div>
                <div className="mb-2 text-xs font-semibold text-stone-500">AI 讲解</div>
                <div className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-7">
                  {interpretation || "正在撰写…"}
                </div>
              </div>
            )}

            {/* 技术细节 */}
            {description && (
              <details className="mt-3 rounded-xl bg-stone-50 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-stone-500">
                  AI 看到的画面（技术细节）
                </summary>
                <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-stone-600">
                  {description}
                </div>
              </details>
            )}

            {!stage && interpretation && (
              <div className="mt-3 text-xs text-stone-400">
                {DISCLAIMER}
                {elapsed ? ` · ${elapsed}` : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

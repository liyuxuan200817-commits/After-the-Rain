"use client";

import { useState, useRef } from "react";

type Candidate = {
  name: string;
  school: string;
  region: string;
  score: number;
};

type Result = {
  description: string;
  candidates: Candidate[];
  interpretation: string;
  disclaimer: string;
  elapsedMs: number;
};

/**
 * 浏览器端图片压缩
 * 目的：手机拍的原图动辄 4-8MB，Vercel 请求体上限约 4.5MB，
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
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    setError("");
    setResult(null);
    setLoading(true);
    setStage("正在压缩图片…");

    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);

      // 估算压缩后体积
      const kb = Math.round((dataUrl.length * 3) / 4 / 1024);
      setMeta(`压缩后约 ${kb} KB`);

      setStage("正在看图…");
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `请求失败 HTTP ${res.status}`);
        return;
      }

      setResult(data as Result);
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`);
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function reset() {
    setPreview("");
    setResult(null);
    setError("");
    setMeta("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
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

      {/* 预览 */}
      {preview && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-56">
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

          <div className="flex-1">
            {loading && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl bg-stone-50">
                <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-[#A62B1F]" />
                <div className="text-sm text-stone-600">{stage}</div>
                <div className="mt-2 text-xs text-stone-400">
                  需要依次完成：看图描述 → 检索馆藏 → 生成讲解，约 10–20 秒
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && result && (
              <div className="space-y-4">
                {/* 相近馆藏 */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-stone-500">
                    检索到的相近馆藏
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.candidates.map((c, i) => (
                      <span
                        key={c.name}
                        className="rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          background: i === 0 ? "#F7E7E8" : "#F5F5F4",
                          color: i === 0 ? "var(--zhuhong)" : "#57534E",
                        }}
                      >
                        {c.name} · {(c.score * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* 讲解 */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-stone-500">AI 讲解</div>
                  <div className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-7">
                    {result.interpretation}
                  </div>
                </div>

                {/* 画面描述（折叠） */}
                <details className="rounded-xl bg-stone-50 p-4">
                  <summary className="cursor-pointer text-xs font-semibold text-stone-500">
                    AI 看到的画面（技术细节）
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-stone-600">
                    {result.description}
                  </div>
                </details>

                <div className="text-xs text-stone-400">
                  {result.disclaimer} · 耗时 {(result.elapsedMs / 1000).toFixed(1)} 秒
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

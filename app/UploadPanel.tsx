"use client";

import { useState, useRef } from "react";

type Candidate = {
  name: string;
  school: string;
  region: string;
  confidence?: "高" | "中" | "低";
  reason?: string;
};

type Excluded = { school: string; reason: string };

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

const STAGE_TEXT: Record<string, string> = {
  compress: "正在压缩图片…",
  describe: "正在看图，提取画面特征…",
  judge: "正在对照七流派鉴别要点判断…",
  compose: "正在撰写讲解…",
};

export default function UploadPanel() {
  const [preview, setPreview] = useState("");
  const [stage, setStage] = useState<"" | "compress" | "describe" | "judge" | "compose">("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [excluded, setExcluded] = useState<Excluded[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");
  const [timing, setTiming] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = stage !== "";

  function reset() {
    setPreview("");
    setDescription("");
    setCandidates([]);
    setExcluded([]);
    setInterpretation("");
    setError("");
    setMeta("");
    setTiming("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    reset();
    setStage("compress");

    const t0 = Date.now();

    try {
      // ① 压缩
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      setMeta(`压缩后约 ${Math.round((dataUrl.length * 3) / 4 / 1024)} KB`);

      // ② 看图
      setStage("describe");
      const r1 = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const d1 = await r1.json();
      if (!r1.ok) {
        setError(d1.error || `看图失败 HTTP ${r1.status}`);
        setStage("");
        return;
      }
      setDescription(d1.description);

      // ③ 判断流派（大模型对照鉴别要点）
      setStage("judge");
      const r2 = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: d1.description }),
      });
      const d2 = await r2.json();
      if (!r2.ok) {
        setError(d2.error || `判断失败 HTTP ${r2.status}`);
        setStage("");
        return;
      }
      setCandidates(d2.candidates ?? []);
      setExcluded(d2.excluded ?? []);

      // ④ 生成讲解（流式）
      setStage("compose");
      const r3 = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: d1.description, candidates: d2.candidates }),
      });

      if (!r3.ok || !r3.body) {
        setError((await r3.text()) || `讲解生成失败 HTTP ${r3.status}`);
        setStage("");
        return;
      }

      const reader = r3.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setInterpretation(acc);
      }

      setTiming(`总耗时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`);
    } finally {
      setStage("");
    }
  }

  const confColor = (c?: string) =>
    c === "高" ? "#166534" : c === "中" ? "#8A6A12" : "#9A5B00";
  const confBg = (c?: string) =>
    c === "高" ? "#DCFCE7" : c === "中" ? "#FDF6E3" : "#FEF3C7";

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
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }} />
        </label>
      )}

      {preview && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-52 shrink-0">
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
            {stage && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-[#A62B1F]" />
                {STAGE_TEXT[stage] ?? ""}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {candidates.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-xs font-semibold text-stone-500">
                  流派判断（对照七流派鉴别要点，按可能性排序）
                </div>
                <div className="space-y-2">
                  {candidates.map((c, i) => (
                    <div
                      key={c.school}
                      className="rounded-lg border px-3 py-2"
                      style={{
                        borderColor: i === 0 ? "#E8C4C7" : "#E7E5E4",
                        background: i === 0 ? "#FDF6F6" : "#FAFAF9",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: i === 0 ? "var(--zhuhong)" : "#57534E" }}>
                          {i + 1}. {c.school}
                        </span>
                        {c.confidence && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[11px]"
                            style={{ background: confBg(c.confidence), color: confColor(c.confidence) }}
                          >
                            把握{c.confidence}
                          </span>
                        )}
                        {c.region && <span className="text-[11px] text-stone-400">{c.region}</span>}
                      </div>
                      {c.reason && (
                        <div className="mt-1 text-xs leading-5 text-stone-500">{c.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
                {excluded.length > 0 && (
                  <div className="mt-2 text-xs text-stone-400">
                    已排除：{excluded.map((e) => e.school).join("、")}
                  </div>
                )}
              </div>
            )}

            {(interpretation || stage === "compose") && (
              <div>
                <div className="mb-2 text-xs font-semibold text-stone-500">AI 讲解</div>
                <div className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-7">
                  {interpretation || "正在撰写…"}
                </div>
              </div>
            )}

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
                {timing ? ` · ${timing}` : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

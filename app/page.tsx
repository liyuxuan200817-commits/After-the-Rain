import fs from "node:fs";
import path from "node:path";
import ChatBox from "./ChatBox";
import type { Item } from "@/lib/rag";

function loadItems(): Item[] {
  const p = path.join(process.cwd(), "data", "ich-items.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as Item[];
}

export default function Home() {
  const items = loadItems();
  const schools = items.filter((i) => i.school && i.school !== "通用");

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* 顶部 */}
      <header className="mb-10 border-b-2 pb-6" style={{ borderColor: "var(--zhuhong)" }}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold" style={{ color: "var(--zhuhong)" }}>
            年画档案
          </h1>
          <span className="text-sm text-stone-400">AfterRain · 雨后天晴，伴你而行</span>
        </div>
        <p className="mt-3 text-sm text-stone-600 leading-6">
          中国木版年画的数字馆藏助手 —— 收录
          <strong> {schools.length} 大流派</strong>，{items.length} 条档案。
          提问时 AI 只依据馆藏资料作答，并注明来源，查不到就明说。
        </p>
      </header>

      {/* 问答区 */}
      <ChatBox />

      {/* 馆藏 */}
      <section className="mt-14">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-xl">📜</span>
          <h2 className="text-lg font-bold" style={{ color: "var(--zhuhong)" }}>
            馆藏档案
          </h2>
          <span className="text-xs text-stone-400">共 {items.length} 条</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <article
              key={it.id}
              className="nh-card rounded-xl border border-stone-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-stone-800">{it.name}</h3>
                <span
                  className="shrink-0 rounded px-2 py-0.5 text-[11px]"
                  style={{ background: "#FDF6E3", color: "#8A6A12" }}
                >
                  {it.school}
                </span>
              </div>

              <div className="mt-2 text-xs text-stone-500">
                {it.category} · {it.region}
              </div>

              {it.style && (
                <p className="mt-3 line-clamp-3 text-xs leading-6 text-stone-600">
                  {it.style}
                </p>
              )}

              {it.themes && it.themes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {it.themes.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
        2026 第九届传智杯 · AI WEB 网页开发挑战赛 · AfterRain 队
      </footer>
    </main>
  );
}

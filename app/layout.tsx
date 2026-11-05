import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "年画档案 · AfterRain",
  description: "雨后天晴，伴你而行 —— 上传一张年画，AI 告诉你它的流派、故事与寓意",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

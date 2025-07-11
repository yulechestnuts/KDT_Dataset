import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toolbar } from "@/components/common/toolbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KDT 훈련기관 비교",
  description: "KDT 관련 데이터 분석을 위한 사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script src="https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"></script>
        <script src="https://unpkg.com/@pdftron/pdfjs-express/dist/pdfjs-express.min.js"></script>
      </head>
      <body className={inter.className}>
        <Toolbar />
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}

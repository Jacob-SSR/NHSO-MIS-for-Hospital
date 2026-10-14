import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Planfin HC10909 · รพ.พลับพลาชัย",
  description: "แดชบอร์ดเงินโอน สปสช. และผลงาน MIS พร้อมแจ้งเตือนเงินเข้าผ่าน LINE (MOPH Notify) สำหรับโรงพยาบาลพลับพลาชัย รหัส 10909",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3fbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#081713" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}

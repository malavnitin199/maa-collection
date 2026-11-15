import type { Metadata, Viewport } from "next";
import { BRAND_GREEN } from "@/lib/app-icon";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maa Collection",
  description: "Retail inventory and point-of-sale for Maa Collection",
  appleWebApp: { capable: true, title: "Maa Collection", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: BRAND_GREEN };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

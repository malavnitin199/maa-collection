import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { LocaleRoot } from "@/features/i18n/locale-root";
import { BRAND_GREEN } from "@/lib/app-icon";
import { Geist_Mono, Mukta, Rozha_One } from "next/font/google";
import { AppearanceSync } from "@/features/appearance/appearance-sync";
import { APPEARANCE_SCRIPT } from "@/features/appearance/appearance";
import "./globals.css";

// Body: Mukta (clear at small sizes, Latin + Devanagari). Headlines: Rozha One (Indian print display face).
const mukta = Mukta({
  variable: "--font-mukta",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "devanagari"],
});

const rozha = Rozha_One({
  variable: "--font-rozha",
  weight: "400",
  subsets: ["latin", "devanagari"],
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
      // Theme and day/night are set by the script below before the first paint (per phone).
      data-theme="peacock"
      data-mode="light"
      suppressHydrationWarning
      className={`${mukta.variable} ${rozha.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppearanceSync />
        {/* The person's language (needs the request), so pages render inside this boundary. */}
        <Suspense fallback={null}>
          <LocaleRoot>{children}</LocaleRoot>
        </Suspense>
      </body>
    </html>
  );
}

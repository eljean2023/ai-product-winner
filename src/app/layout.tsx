import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CountrySelect from "@/components/CountrySelect";
import { MarketplaceCountryProvider } from "@/components/MarketplaceCountryContext";
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
  title: "AI Product Hunter",
  description: "Find profitable products before investing money.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface dark:bg-slate-950">
        <MarketplaceCountryProvider>
          <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-sm">
                  AI
                </span>
                <span className="text-sm font-bold tracking-tight text-dark dark:text-slate-100">
                  AI Product Hunter
                </span>
              </div>
              <CountrySelect />
            </div>
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
        </MarketplaceCountryProvider>
      </body>
    </html>
  );
}

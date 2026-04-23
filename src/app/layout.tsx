import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://local.mlabsdigital.org"),
  title: {
    default: "Local AI — Know your Google presence. Grow your business.",
    template: "%s · Local AI",
  },
  description: "AI-powered insights for your Google Business Profile. Track calls, directions, reviews, and customer behavior across all your locations — in one beautiful dashboard.",
  keywords: ["google business profile", "local seo analytics", "gmb dashboard", "multi-location analytics", "review management", "local ai", "mlabs"],
  authors: [{ name: "MLabs Digital", url: "https://mlabsdigital.org" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Local AI",
    title: "Local AI — Know your Google presence. Grow your business.",
    description: "AI-powered insights for your Google Business Profile across all your locations.",
    url: "https://local.mlabsdigital.org",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Local AI — Know your Google presence. Grow your business.",
    description: "AI-powered insights for your Google Business Profile across all your locations.",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-white font-sans antialiased">{children}</body>
    </html>
  );
}

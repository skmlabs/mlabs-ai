import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://app.mlabsdigital.org"),
  title: {
    default: "MLabs AI — Marketing Intelligence for Multi-Location Brands",
    template: "%s · MLabs AI",
  },
  description: "Unified marketing intelligence for multi-location brands and agencies. Connect GMB, Meta Ads, Google Ads. Understand what's driving calls, foot traffic, and revenue — not just clicks.",
  keywords: ["marketing intelligence", "multi-location analytics", "gmb dashboard", "marketing attribution", "local seo analytics", "mlabs"],
  authors: [{ name: "MLabs Digital", url: "https://mlabsdigital.org" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "MLabs AI",
    title: "MLabs AI — Marketing Intelligence for Multi-Location Brands",
    description: "Unified marketing intelligence for multi-location brands and agencies.",
    url: "https://app.mlabsdigital.org",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "MLabs AI — Marketing Intelligence for Multi-Location Brands",
    description: "Unified marketing intelligence for multi-location brands and agencies.",
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

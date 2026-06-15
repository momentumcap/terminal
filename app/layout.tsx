import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://momentumterminal.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Momentum Terminal",
  description: "Base L2 token momentum intelligence for active traders",
  applicationName: "Momentum Terminal",
  openGraph: {
    title: "Momentum Terminal",
    description: "Base L2 token momentum intelligence for active traders",
    url: siteUrl,
    siteName: "Momentum Terminal",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Momentum Terminal",
    description: "Base L2 token momentum intelligence for active traders"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}

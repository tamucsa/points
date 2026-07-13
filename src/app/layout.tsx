import type { Metadata } from "next";
import { Bayon, Akshar } from "next/font/google";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next"

const bayon = Bayon({
  variable: "--font-bayon",
  subsets: ["latin"],
  weight: "400",
});

const akshar = Akshar({
  variable: "--font-akshar",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://points.csatamu.org'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TAMU CSA - Points',
    template: '%s — TAMU CSA Points',
  },
  description: 'The point tracking system for the Texas A&M Chinese Student Association.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'TAMU CSA Points',
    title: 'TAMU CSA - Points',
    description: 'The point tracking system for the Texas A&M Chinese Student Association.',
    images: [
      {
        url: '/logo.png',
        alt: 'TAMU CSA Points',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'TAMU CSA - Points',
    description: 'The point tracking system for the Texas A&M Chinese Student Association.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bayon.variable} ${akshar.variable} font-sans antialiased bg-bg text-text`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
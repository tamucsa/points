import type { Metadata } from "next";
import { Bayon, Akshar } from "next/font/google";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next"
import ThemeProvider from "@/app/components/ThemeProvider";
import { DEFAULT_SITE_ORIGIN, configuredSiteOrigin } from "@/utils/public-origin";

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

const siteUrl = configuredSiteOrigin() ?? DEFAULT_SITE_ORIGIN

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${bayon.variable} ${akshar.variable} font-sans antialiased bg-bg text-text`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
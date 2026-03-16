import type { Metadata } from "next";
import { Bayon, Akshar } from "next/font/google";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next"

const bayon = Bayon({
  // variable: "--font-bayon",
  subsets: ["latin"],
  weight: "400",
});

const akshar = Akshar({
  // variable: "--font-akshar",
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  title: "TAMU CSA - Points",
  description: "The point tracking system for the Texas A&M Chinese Student Association.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bayon.className} ${akshar.className} antialiased bg-white text-black`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
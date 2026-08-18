"use client";

import * as Sentry from "@sentry/nextjs";
import { Akshar, Bayon } from "next/font/google";
import { useEffect } from "react";
import ThemeProvider from "@/app/components/ThemeProvider";
import "@/app/globals.css";

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${bayon.variable} ${akshar.variable} font-sans antialiased bg-bg text-text`}
      >
        <ThemeProvider>
          <div className="flex h-screen items-center justify-center">
            <div className="mx-5 flex flex-col items-center gap-8 text-center">
              <div>
                <h1 className="font-primary text-6xl leading-none sm:text-8xl">
                  Error
                </h1>
                <h2 className="mt-4 font-secondary text-2xl sm:text-4xl">
                  Something went wrong
                </h2>
                <p className="mt-2 font-secondary text-base text-subtitle sm:text-xl">
                  An unexpected error occurred. You can try again, or go back
                  home.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="w-full rounded-lg border-2 p-3 text-center font-primary text-2xl tracking-wider outline outline-black transition-colors hover:text-primary hover:outline-primary sm:text-3xl"
                >
                  Try again
                </button>
                <a
                  href="/"
                  className="w-full rounded-lg border-2 p-3 text-center font-primary text-2xl tracking-wider outline outline-black transition-colors hover:text-primary hover:outline-primary sm:text-3xl"
                >
                  Home
                </a>
              </div>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

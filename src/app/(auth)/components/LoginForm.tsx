"use client";
import { Calendar, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthFeatureCard from "@/app/(auth)/components/AuthFeatureCard";
import PublicPageShell from "@/app/(auth)/components/PublicPageShell";
import BrandMark from "@/app/components/BrandMark";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const authError = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const googleHref = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  return (
    <PublicPageShell>
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-lg lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden bg-hero-gradient p-8 sm:p-10 lg:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-surface/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Texas A&amp;M Chinese Student Association
            </div>

            <div className="max-w-lg">
              <div className="mb-5 flex items-center gap-3">
                <BrandMark size="lg" priority />
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-subtitle">
                  Official member portal
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-5xl">
                TAMU CSA Points
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-subtitle sm:text-lg">
                The official points and attendance system for the Texas A&amp;M
                Chinese Student Association. Members sign in with their TAMU
                Google account to track event participation, view leaderboards,
                and manage their CSA profile.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <AuthFeatureCard
                icon={Calendar}
                title="Events"
                description="Browse upcoming CSA events and check in quickly."
              />
              <AuthFeatureCard
                icon={Star}
                title="Points"
                description="Track attendance and earn points throughout the semester."
              />
              <AuthFeatureCard
                icon={Trophy}
                title="Leaderboard"
                description="See member and Jiating rankings for the active semester."
                accent
              />
            </div>
          </div>

          <div className="flex items-center justify-center bg-surface p-8 sm:p-10 lg:p-12">
            <div className="mx-auto flex w-full max-w-md flex-col rounded-[1.75rem] border border-home-border bg-bg p-7 shadow-theme-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <BrandMark size="lg" />
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                    Member access
                  </div>
                  <div className="text-sm text-subtitle">
                    Secure TAMU sign-in
                  </div>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-accent/35 bg-accent-card p-4">
                <div className="text-sm font-semibold text-text">
                  TAMU email required
                </div>
                <div className="mt-1 text-sm leading-6 text-subtitle">
                  Sign in with the Google account associated with your Texas
                  A&amp;M email address.
                </div>
              </div>

              <div className="mt-6 flex flex-col">
                {authError && (
                  <div className="mb-4 rounded-2xl border border-error-border bg-error-bg p-3.5">
                    <p className="text-sm leading-6 text-error">
                      {authError === "invalid_domain"
                        ? "Please sign in with your @tamu.edu Google account."
                        : "Sign-in failed. Please try again."}
                    </p>
                  </div>
                )}

                <a
                  href={googleHref}
                  onClick={() => setLoading(true)}
                  aria-disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-3 text-center text-[15px] font-semibold text-on-primary shadow-theme-primary transition duration-150 hover:bg-primary-hover aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:bg-disabled aria-disabled:text-on-primary/80"
                >
                  {loading ? "Redirecting…" : "Sign in with Google"}
                </a>

                <div className="mt-3 space-y-1 border-t border-home-border/70 pt-3 text-center text-xs leading-5 text-subtitle">
                  <p>Redirected to Google to complete sign-in.</p>
                  <p>
                    By signing in, you agree to our{" "}
                    <Link
                      href="/terms"
                      className="font-medium text-primary hover:text-primary-hover"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-primary hover:text-primary-hover"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}

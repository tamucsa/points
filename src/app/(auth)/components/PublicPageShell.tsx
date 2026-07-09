import Link from 'next/link'
import type { ReactNode } from 'react'

interface PublicPageShellProps {
  children: ReactNode
  showFooter?: boolean
}

export default function PublicPageShell({ children, showFooter = true }: PublicPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-10 text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,121,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,176,195,0.22),transparent_38%)]" />
      <div className="absolute -left-24 top-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-8 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-6xl">
        {children}

        {showFooter && (
          <footer className="mt-10 flex flex-col items-center gap-2 border-t border-home-border/80 pt-6 text-center text-sm text-subtitle sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/privacy" className="font-medium text-primary transition hover:text-[#35679e]">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline text-home-border">|</span>
            <Link href="/terms" className="font-medium text-primary transition hover:text-[#35679e]">
              Terms of Service
            </Link>
            <span className="hidden sm:inline text-home-border">|</span>
            <Link href="https://csatamu.org" className="transition hover:text-text">
              csatamu.org
            </Link>
          </footer>
        )}
      </div>
    </div>
  )
}

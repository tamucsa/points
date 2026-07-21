import Link from 'next/link'
import type { ReactNode } from 'react'
import ThemeToggle from '@/app/components/ThemeToggle'

interface PublicPageShellProps {
  children: ReactNode
  showFooter?: boolean
}

export default function PublicPageShell({ children, showFooter = true }: PublicPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-10 text-text">
      <div className="absolute inset-0 bg-public-gradient" />
      <div className="absolute -left-24 top-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-8 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle className="!w-auto" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        {children}

        {showFooter && (
          <footer className="mt-10 flex flex-col items-center gap-2 border-t border-home-border/80 pt-6 text-center text-sm text-subtitle sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/privacy" className="font-medium text-primary transition hover:text-primary-hover">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline text-home-border">|</span>
            <Link href="/terms" className="font-medium text-primary transition hover:text-primary-hover">
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

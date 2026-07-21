import type { Metadata } from 'next'
import Link from 'next/link'
import BackLink from '@/app/components/BackLink'
import PublicPageShell from '@/app/(auth)/components/PublicPageShell'

export const metadata: Metadata = {
  title: 'Terms of Service — TAMU CSA Points',
  description: 'Terms of service for the Texas A&M Chinese Student Association Points application.',
}

export default function TermsPage() {
  return (
    <PublicPageShell>
      <BackLink href="/" label="Back to sign in" className="mb-6" />
      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-lg">
        <div className="border-b border-home-border bg-hero-gradient px-8 py-10 sm:px-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-surface/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
            Texas A&amp;M Chinese Student Association
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-subtitle">
            Last updated: July 8, 2026
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-subtitle">
            These Terms of Service (&quot;Terms&quot;) govern your use of TAMU CSA Points (&quot;the App&quot;),
            operated by the Texas A&amp;M Chinese Student Association (&quot;CSA&quot;). By signing in or
            using the App at{' '}
            <Link href="/" className="font-medium text-primary hover:text-primary-hover">points.csatamu.org</Link>,
            you agree to these Terms and our{' '}
            <Link href="/privacy" className="font-medium text-primary hover:text-primary-hover">Privacy Policy</Link>.
          </p>
        </div>

        <div className="space-y-8 px-8 py-10 text-sm leading-7 text-subtitle sm:px-12 sm:text-[15px]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">1. Eligibility</h2>
            <p>
              The App is intended for Texas A&amp;M University students participating in CSA programs.
              You must sign in with a valid <strong className="font-semibold text-text">@tamu.edu</strong> Google
              account. CSA may restrict or revoke access if you are not an eligible member or if your
              account does not meet membership requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">2. Purpose of the App</h2>
            <p>
              The App helps CSA members track event attendance, earn points, view leaderboards, and
              manage membership information for CSA activities. Points and attendance records are used
              for CSA programming and recognition. They are not official Texas A&amp;M University academic
              or administrative records.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">3. Your responsibilities</h2>
            <p className="mb-3">When using the App, you agree to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide accurate membership information during registration</li>
              <li>Use only your own @tamu.edu Google account to sign in</li>
              <li>Check in to events only when you are actually present and eligible</li>
              <li>Not attempt to manipulate points, attendance, or leaderboard data</li>
              <li>Not misuse, disrupt, or attempt unauthorized access to the App or its data</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">4. Points and attendance</h2>
            <p>
              Points are awarded based on CSA event rules for the active semester. CSA Officers may
              correct attendance or points records when errors are identified. CSA reserves the right
              to adjust, revoke, or recalculate points that were obtained through mistake, misuse, or
              violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">5. Account access and suspension</h2>
            <p>
              CSA may suspend or remove access to the App if you violate these Terms, provide false
              information, or engage in conduct that harms CSA members or operations. Membership
              status (including pending, active, or inactive) is managed by CSA Officers, your parent,
              and the Secretary according to CSA procedures.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">6. Intellectual property</h2>
            <p>
              The App, including its design, content, and branding, is operated for CSA. You may not
              copy, scrape, reverse engineer, or redistribute the App or its data except as permitted
              through normal use of CSA features (such as viewing your own profile or public leaderboards).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">7. Disclaimer</h2>
            <p>
              The App is provided on an &quot;as is&quot; and &quot;as available&quot; basis for CSA member use.
              CSA does not guarantee uninterrupted access, error-free operation, or that points data
              will always be immediately accurate. The App is a student organization tool and is not
              affiliated with or endorsed by Texas A&amp;M University as an official university system.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, CSA and its officers shall not be liable for any
              indirect, incidental, or consequential damages arising from your use of the App, including
              loss of data or inability to access the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">9. Changes to these Terms</h2>
            <p>
              CSA may update these Terms from time to time. Material changes will be posted on this
              page with an updated &quot;Last updated&quot; date. Continued use of the App after changes
              constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">10. Contact</h2>
            <p>
              For questions about these Terms, contact CSA through{' '}
              <Link href="https://csatamu.org" className="font-medium text-primary hover:text-primary-hover">
                csatamu.org
              </Link>{' '}
              or reach out to a CSA Officer, your parent, or the Secretary directly.
            </p>
          </section>

          <div className="border-t border-home-border pt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-theme-primary transition hover:bg-primary-hover"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}

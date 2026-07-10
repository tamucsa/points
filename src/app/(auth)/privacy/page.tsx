import type { Metadata } from 'next'
import Link from 'next/link'
import BackLink from '@/app/components/BackLink'
import PublicPageShell from '@/app/(auth)/components/PublicPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy — TAMU CSA Points',
  description: 'Privacy policy for the Texas A&M Chinese Student Association Points application.',
}

export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <BackLink href="/" label="Back to sign in" className="mb-6" />
      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="border-b border-home-border bg-[linear-gradient(135deg,rgba(71,121,184,0.08),rgba(255,255,255,0.9)_52%,rgba(240,176,195,0.16))] px-8 py-10 sm:px-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
            Texas A&amp;M Chinese Student Association
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-subtitle">
            Last updated: July 8, 2026
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-subtitle">
            This policy describes how TAMU CSA Points (&quot;the App&quot;), operated by the Texas A&amp;M
            Chinese Student Association (&quot;CSA&quot;), collects, uses, and protects information when you
            use <Link href="/" className="font-medium text-primary hover:text-[#35679e]">points.csatamu.org</Link>.
          </p>
        </div>

        <div className="space-y-8 px-8 py-10 text-sm leading-7 text-subtitle sm:px-12 sm:text-[15px]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">1. Who can use this app</h2>
            <p>
              The App is intended for Texas A&amp;M University students participating in CSA. Sign-in is
              limited to Google accounts with an <strong className="font-semibold text-text">@tamu.edu</strong> email
              address. We do not offer access to the general public.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">2. Information we collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-text">Google account information (via Sign in with Google):</strong>{' '}
                your TAMU email address, name, and profile picture. We request only the{' '}
                <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-text">openid</code>,{' '}
                <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-text">email</code>, and{' '}
                <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-text">profile</code> scopes
                needed to authenticate you and display your identity in the App.
              </li>
              <li>
                <strong className="font-semibold text-text">Membership information you provide:</strong>{' '}
                full name (first and last), class, and optional phone number during registration.
              </li>
              <li>
                <strong className="font-semibold text-text">Activity data:</strong> event attendance,
                points earned, Jiating (family group) assignment, and role/status within CSA (member
                or CSA Officer).
              </li>
              <li>
                <strong className="font-semibold text-text">Technical data:</strong> basic usage analytics
                (such as page views) collected by our hosting provider to help us understand how the App
                is used. This data is aggregated and not used to identify you for advertising.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">3. How we use Google user data</h2>
            <p className="mb-3">
              Google user data obtained through Sign in with Google is used only to:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Verify your identity and confirm you are signing in with a @tamu.edu account</li>
              <li>Create and link your App account to your CSA membership record</li>
              <li>Display your name and profile image within the App (profile, leaderboard, check-in lists)</li>
            </ul>
            <p className="mt-3">
              We do not use Google user data for advertising, sell it to third parties, or use it for
              purposes unrelated to operating the App. Our use of Google user data complies with
              Google&apos;s Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">4. How we store and protect data</h2>
            <p>
              Member and attendance data is stored in a Supabase (PostgreSQL) database with row-level
              security policies. Authentication sessions are managed through Supabase Auth. Access to
              membership and points data is restricted to CSA Officers, your parent, and the Secretary
              who need it to run events, manage membership, and maintain points records.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">5. Who can see your information</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-text">You</strong> can view your own profile and points.
              </li>
              <li>
                <strong className="font-semibold text-text">Active CSA members</strong> can view leaderboard
                rankings and event listings appropriate to their membership.
              </li>
              <li>
                <strong className="font-semibold text-text">CSA Officers, your parent, and the Secretary</strong>{' '}
                can view member names, emails, attendance, and points as needed to operate CSA programs.
              </li>
            </ul>
            <p className="mt-3">
              We do not share your personal information with advertising platforms, data brokers, or
              other third parties for their independent use.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">6. Data retention and deletion</h2>
            <p>
              We retain membership and points data for as long as you are an active CSA participant and
              as needed for semester records. If you would like your account or personal data removed,
              contact a CSA Officer, your parent, or the Secretary. We will process deletion requests within a reasonable
              timeframe, subject to any records we are required to keep for organizational purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">7. Third-party services</h2>
            <p>
              The App uses Supabase for authentication and data storage, Google for sign-in, and Vercel
              for hosting. These providers process data on our behalf under their respective privacy
              policies and only as needed to operate the App. Google OAuth is used solely for
              authentication; we do not access your Gmail, Drive, Calendar, or other Google services
              through this App.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">8. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected on this
              page with an updated &quot;Last updated&quot; date. Continued use of the App after changes
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text">9. Contact</h2>
            <p>
              For privacy questions or data requests, contact CSA through{' '}
              <Link href="https://csatamu.org" className="font-medium text-primary hover:text-[#35679e]">
                csatamu.org
              </Link>{' '}
              or reach out to a CSA Officer, your parent, or the Secretary directly.
            </p>
          </section>

          <div className="border-t border-home-border pt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(71,121,184,0.24)] transition hover:bg-[#35679e]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}

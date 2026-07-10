import { redirect } from 'next/navigation'

type LoginRedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginRedirectPage({ searchParams }: LoginRedirectPageProps) {
  const params = await searchParams
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(key, value)
    }
  }

  const qs = query.toString()
  redirect(qs ? `/?${qs}` : '/')
}

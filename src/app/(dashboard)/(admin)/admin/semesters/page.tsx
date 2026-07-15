import { redirect } from 'next/navigation'
import SemesterAdminClient from '@/app/(dashboard)/(admin)/admin/semesters/components/SemesterAdminClient'
import { listSemesters } from '@/app/actions/semesters'

export default async function AdminSemestersPage() {
  const { semesters, error } = await listSemesters()
  if (error === 'Not authenticated.') redirect('/')
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-red-600 lg:px-8">
        {error}
      </div>
    )
  }

  return <SemesterAdminClient semesters={semesters} />
}

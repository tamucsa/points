import { redirect } from 'next/navigation'
import SemesterAdminClient from '@/app/(dashboard)/(admin)/admin/semesters/components/SemesterAdminClient'
import { listSemesters } from '@/app/actions/semesters'

export default async function AdminSemestersPage() {
  const { semesters, years, error } = await listSemesters()
  if (error === 'Not authenticated.') redirect('/')

  return <SemesterAdminClient semesters={semesters} years={years} />
}

import { redirect } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import SentryUser from "@/app/components/SentryUser";
import ThemeSync from "@/app/components/ThemeSync";
import { getCurrentMember } from "@/utils/supabase/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, member } = await getCurrentMember();

  if (!user) redirect("/");
  if (!member) redirect("/register");

  if (member.status === "pending_member" || member.status === "pending_jt")
    redirect("/pending");

  return (
    <div className="flex min-h-screen bg-bg text-text lg:h-screen lg:overflow-hidden print:block print:h-auto print:overflow-visible">
      <SentryUser id={member.id} role={member.role} />
      <ThemeSync preference={member.theme_preference ?? "system"} />
      <Sidebar member={member} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-page-gradient pt-14 lg:pt-0 print:overflow-visible print:bg-surface print:p-0 print:pt-0">
        {children}
      </main>
    </div>
  );
}

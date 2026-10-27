import RewardsClient from "@/app/(dashboard)/(officer)/officer/rewards/components/RewardsClient";
import { loadGmRewardReport } from "@/app/actions/recap";

export default async function FormalRewardsPage() {
  const report = await loadGmRewardReport();

  return (
    <RewardsClient
      semesterName={report.semesterName}
      rows={report.rows}
      error={report.error}
    />
  );
}

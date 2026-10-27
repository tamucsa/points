import BattlePassTrackingClient from "@/app/(dashboard)/(officer)/officer/rewards/bp/components/BattlePassTrackingClient";
import { loadBattlePassTracking } from "@/app/actions/battle-pass";

export default async function BattlePassTrackingPage() {
  const report = await loadBattlePassTracking();

  return (
    <BattlePassTrackingClient
      semesterName={report.semesterName}
      rewards={report.rewards}
      rows={report.rows}
      error={report.error}
    />
  );
}

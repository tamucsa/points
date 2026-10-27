"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Formals", path: "/officer/rewards/formals" },
  { label: "Battle Pass", path: "/officer/rewards/bp" },
] as const;

export default function RewardTrackingTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path);
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-primary text-on-primary shadow-sm"
                : "border border-home-border bg-surface text-subtitle hover:border-primary/30 hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

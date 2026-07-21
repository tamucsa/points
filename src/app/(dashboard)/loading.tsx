export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-6 py-8 lg:px-8">
      <div className="mb-6">
        <div className="h-9 w-52 rounded-xl bg-home-border/70" />
        <div className="mt-2 h-4 w-36 rounded-lg bg-home-border/50" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-[4.5rem] rounded-3xl border border-home-border bg-surface shadow-sm"
          />
        ))}
      </div>
    </div>
  )
}

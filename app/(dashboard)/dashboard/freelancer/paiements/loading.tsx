export default function PaiementsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#F5F5F0] rounded" />
      <div className="grid gap-4 md:grid-cols-3 mb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E0D9] p-5 space-y-2">
            <div className="h-4 w-1/2 bg-[#F5F5F0] rounded" />
            <div className="h-7 w-2/3 bg-[#F5F5F0] rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E0D9] p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 w-48 bg-[#F5F5F0] rounded" />
              <div className="h-3 w-32 bg-[#F5F5F0] rounded" />
            </div>
            <div className="h-6 w-20 bg-[#F5F5F0] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

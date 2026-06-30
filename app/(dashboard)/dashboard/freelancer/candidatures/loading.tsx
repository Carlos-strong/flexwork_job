export default function CandidaturesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[#F5F5F0] rounded" />
      <div className="h-4 w-96 bg-[#F5F5F0] rounded" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E0D9] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 bg-[#F5F5F0] rounded" />
                <div className="h-3 w-1/2 bg-[#F5F5F0] rounded" />
                <div className="h-3 w-1/3 bg-[#F5F5F0] rounded" />
              </div>
              <div className="h-6 w-20 bg-[#F5F5F0] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

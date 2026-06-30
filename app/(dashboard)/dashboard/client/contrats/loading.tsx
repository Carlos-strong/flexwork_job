export default function ContratsClientLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#F5F5F0] rounded" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E0D9] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-2/3 bg-[#F5F5F0] rounded" />
              <div className="h-6 w-24 bg-[#F5F5F0] rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-3 w-full bg-[#F5F5F0] rounded" />
              <div className="h-3 w-full bg-[#F5F5F0] rounded" />
              <div className="h-3 w-full bg-[#F5F5F0] rounded" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-8 w-28 bg-[#F5F5F0] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

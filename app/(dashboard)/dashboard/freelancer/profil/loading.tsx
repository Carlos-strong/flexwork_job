export default function ProfilFreelancerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[#F5F5F0] rounded" />
      <div className="h-4 w-80 bg-[#F5F5F0] rounded" />
      <div className="flex gap-3 mb-2">
        <div className="h-10 w-40 bg-[#F5F5F0] rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E0D9] p-5 space-y-3">
            <div className="h-5 w-1/2 bg-[#F5F5F0] rounded" />
            <div className="h-3 w-3/4 bg-[#F5F5F0] rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-[#F5F5F0] rounded-full" />
              <div className="h-6 w-20 bg-[#F5F5F0] rounded-full" />
              <div className="h-6 w-14 bg-[#F5F5F0] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

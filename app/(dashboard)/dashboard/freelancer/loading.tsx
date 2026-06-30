import { CardSkeleton } from "@/components/elements/loading-skeleton";

export default function FreelancerDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#F5F5F0] rounded" />
      <div className="h-4 w-64 bg-[#F5F5F0] rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div>
        <div className="h-6 w-40 bg-[#F5F5F0] rounded mb-4" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <div className="h-4 w-3/4 bg-[#F5F5F0] rounded mb-2" />
            <div className="h-3 w-1/4 bg-[#F5F5F0] rounded mb-2" />
            <div className="h-2 w-full bg-[#F5F5F0] rounded" />
          </div>
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <div className="h-4 w-2/3 bg-[#F5F5F0] rounded mb-2" />
            <div className="h-3 w-1/4 bg-[#F5F5F0] rounded mb-2" />
            <div className="h-2 w-full bg-[#F5F5F0] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

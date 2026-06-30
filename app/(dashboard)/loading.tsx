import { CardSkeleton } from "@/components/elements/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#F5F5F0] rounded" />
      <div className="h-4 w-72 bg-[#F5F5F0] rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-36 bg-[#F5F5F0] rounded" />
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <div className="h-5 w-3/4 bg-[#F5F5F0] rounded mb-3" />
          <div className="h-3 w-1/2 bg-[#F5F5F0] rounded" />
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <div className="h-5 w-2/3 bg-[#F5F5F0] rounded mb-3" />
          <div className="h-3 w-1/3 bg-[#F5F5F0] rounded" />
        </div>
      </div>
    </div>
  );
}

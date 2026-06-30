import { ListSkeleton } from "@/components/elements/loading-skeleton";

export default function ClientDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#F5F5F0] rounded" />
      <div className="h-4 w-64 bg-[#F5F5F0] rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <div className="h-4 w-24 bg-[#F5F5F0] rounded mb-3" />
          <div className="h-8 w-12 bg-[#F5F5F0] rounded" />
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <div className="h-4 w-24 bg-[#F5F5F0] rounded mb-3" />
          <div className="h-8 w-16 bg-[#F5F5F0] rounded" />
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <div className="h-4 w-28 bg-[#F5F5F0] rounded mb-3" />
          <div className="h-8 w-8 bg-[#F5F5F0] rounded" />
        </div>
      </div>
      <div>
        <div className="h-6 w-32 bg-[#F5F5F0] rounded mb-4" />
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}

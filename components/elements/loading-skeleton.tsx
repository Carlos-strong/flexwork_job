export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[#E2E0D9] p-6 animate-pulse">
      <div className="h-4 w-24 bg-[#F5F5F0] rounded mb-3" />
      <div className="h-8 w-16 bg-[#F5F5F0] rounded" />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#E2E0D9] p-5">
          <div className="h-5 w-48 bg-[#F5F5F0] rounded mb-2" />
          <div className="h-3 w-32 bg-[#F5F5F0] rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[#E2E0D9] overflow-hidden animate-pulse">
      <div className="bg-[#F5F5F0]/50 h-10" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-t flex items-center px-4">
          <div className="h-3 w-32 bg-[#F5F5F0] rounded" />
        </div>
      ))}
    </div>
  );
}

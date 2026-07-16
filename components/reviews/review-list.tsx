import type { ReviewCard } from "@/lib/reviews";

function StaticStars({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={value >= n ? "text-amber-400" : "text-[#D6D3CC]"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ReviewList({
  reviews,
  emptyLabel,
}: {
  reviews: ReviewCard[];
  emptyLabel: string;
}) {
  if (reviews.length === 0) {
    return <p className="px-6 py-8 text-center text-sm text-[#8a8e82]">{emptyLabel}</p>;
  }
  return (
    <div className="divide-y divide-[#E2E0D9]">
      {reviews.map((r) => (
        <div key={r.id} className="px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1A1916]">{r.missionTitle}</p>
              <p className="text-xs text-[#5A5750]">{r.counterpartName}</p>
            </div>
            <div className="text-right">
              <StaticStars value={r.rating} />
              <p className="mt-0.5 text-xs text-[#8a8e82]">
                {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          {r.comment && <p className="mt-2 text-sm text-[#3a3d36]">{r.comment}</p>}
          {(r.qualityRating || r.communicationRating || r.deadlineRating) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5A5750]">
              {r.qualityRating != null && <span>Qualité : {r.qualityRating}/5</span>}
              {r.communicationRating != null && <span>Communication : {r.communicationRating}/5</span>}
              {r.deadlineRating != null && <span>Délais : {r.deadlineRating}/5</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

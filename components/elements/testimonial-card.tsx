interface TestimonialCardProps {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
  rating: number;
}

export function TestimonialCard({
  name,
  company,
  avatar,
  content,
  rating,
}: TestimonialCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E0D9] p-6 hover:border-[#C3D1F8] hover:shadow-lg transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FD] text-sm font-semibold text-[#2D5BE3]">
          {avatar}
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-[#5A5750]">{company}</p>
        </div>
      </div>
      <p className="text-sm text-[#5A5750] leading-relaxed">
        &ldquo;{content}&rdquo;
      </p>
      <div className="mt-4 flex gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <svg key={i} className="h-4 w-4 fill-yellow-400" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    </div>
  );
}

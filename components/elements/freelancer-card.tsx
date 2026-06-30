import Link from "next/link";

interface FreelancerCardProps {
  id: string;
  name: string;
  title: string;
  rate: string;
  skills: string[];
  rating: number;
}

export function FreelancerCard({
  id,
  name,
  title,
  rate,
  skills,
  rating,
}: FreelancerCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E0D9] p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[#EEF2FD] flex items-center justify-center text-[#2D5BE3] font-semibold">
          {name.charAt(0)}
        </div>
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="text-sm text-[#5A5750]">{title}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-[#F5F5F0] px-3 py-1 text-xs font-medium"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-medium">{rate}</span>
        <span className="text-sm text-[#5A5750]">★ {rating}</span>
      </div>
      {id && (
        <Link
          href={`/freelancers/${id}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[#E2E0D9] bg-white px-4 py-2 text-sm font-medium hover:bg-[#EEF2FD] transition-colors"
        >
          Voir le profil
        </Link>
      )}
    </div>
  );
}

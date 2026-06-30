interface StatsSectionProps {
  missionsCount: string;
  freelancersCount: string;
  satisfactionRate: string;
}

export function StatsSection({
  missionsCount,
  freelancersCount,
  satisfactionRate,
}: StatsSectionProps) {
  return (
    <section className="border-y bg-[#F5F5F0]/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="relative">
            <p className="text-4xl font-bold text-[#2D5BE3]">{missionsCount}</p>
            <p className="mt-1 text-sm text-[#5A5750]">missions publiées</p>
          </div>
          <div className="relative">
            <p className="text-4xl font-bold text-[#2D5BE3]">{freelancersCount}</p>
            <p className="mt-1 text-sm text-[#5A5750]">freelances inscrits</p>
          </div>
          <div className="relative">
            <p className="text-4xl font-bold text-[#2D5BE3]">{satisfactionRate}</p>
            <p className="mt-1 text-sm text-[#5A5750]">de satisfaction</p>
          </div>
        </div>
      </div>
    </section>
  );
}

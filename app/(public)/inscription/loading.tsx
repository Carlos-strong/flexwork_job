export default function InscriptionLoading() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-md animate-pulse">
        <div className="h-9 w-44 bg-[#F5F5F0] rounded mx-auto" />
        <div className="h-4 w-60 bg-[#F5F5F0] rounded mx-auto mt-2" />
        <div className="mt-8 space-y-5">
          <div className="flex gap-3">
            <div className="flex-1 h-14 bg-[#F5F5F0] rounded-md" />
            <div className="flex-1 h-14 bg-[#F5F5F0] rounded-md" />
          </div>
          <div className="h-10 bg-[#F5F5F0] rounded-md" />
          <div className="h-10 bg-[#F5F5F0] rounded-md" />
          <div className="h-10 bg-[#F5F5F0] rounded-md" />
          <div className="h-11 bg-[#F5F5F0] rounded-md" />
        </div>
      </div>
    </div>
  );
}

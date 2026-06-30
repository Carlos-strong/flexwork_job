import { Suspense } from "react";
import { LoginForm } from "@/components/forms/auth-form";

export const metadata = { title: "Connexion" };

// Skeleton affiché pendant l'hydratation de useSearchParams
function LoginFormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse mt-8">
      <div className="h-10 bg-[#F5F5F0] rounded-md" />
      <div className="h-10 bg-[#F5F5F0] rounded-md" />
      <div className="h-11 bg-[#F5F5F0] rounded-md" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold text-center">Connexion</h1>
        <p className="mt-2 text-center text-sm text-[#5A5750]">
          Accédez à votre espace Flexwork
        </p>
        {/* Suspense requis car LoginForm utilise useSearchParams() */}
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

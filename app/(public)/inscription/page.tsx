"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const RegisterMultiStep = dynamic(
  () => import("@/components/forms/register-multi-step").then((m) => ({ default: m.RegisterMultiStep })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

const RegisterPrestataireMultiStep = dynamic(
  () => import("@/components/forms/register-prestataire-multistep").then((m) => ({ default: m.RegisterPrestataireMultiStep })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse mt-8">
      <div className="flex justify-center gap-6 mb-8">
        <div className="w-8 h-8 bg-[#F5F5F0] rounded-full" />
        <div className="w-8 h-8 bg-[#F5F5F0] rounded-full" />
        <div className="w-8 h-8 bg-[#F5F5F0] rounded-full" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-14 bg-[#F5F5F0] rounded-md" />
        <div className="flex-1 h-14 bg-[#F5F5F0] rounded-md" />
      </div>
      <div className="h-14 bg-[#F5F5F0] rounded-md" />
      <div className="h-14 bg-[#F5F5F0] rounded-md" />
      <div className="h-14 bg-[#F5F5F0] rounded-md" />
      <div className="h-11 bg-[#F5F5F0] rounded-md" />
    </div>
  );
}

type InscriptionType = "client" | "prestataire" | null;

function SelectionType({ onSelect }: { onSelect: (type: InscriptionType) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Inscription</h1>
        <p className="mt-2 text-[#5A5750]">
          Comment souhaitez-vous utiliser Flexwork ?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte Client */}
        <button
          onClick={() => onSelect("client")}
          className="group relative overflow-hidden rounded-lg border-2 border-[#E2E0D9] bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg"
        >
          <div className="absolute inset-0 bg-[#F8F9FD] opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#EEF2FD] text-[#2D5BE3]">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Je suis client</h3>
              <p className="mt-2 text-sm text-[#5A5750]">
                Je souhaite recevoir des services (plomberie, ménage, livraison, etc.)
              </p>
            </div>
            <div className="inline-block rounded-full bg-[#2D5BE3] px-3 py-1 text-xs font-medium text-white">
              Inscription rapide
            </div>
          </div>
        </button>

        {/* Carte Prestataire */}
        <button
          onClick={() => onSelect("prestataire")}
          className="group relative overflow-hidden rounded-lg border-2 border-[#E2E0D9] bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg"
        >
          <div className="absolute inset-0 bg-[#F8F9FD] opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Je suis prestataire</h3>
              <p className="mt-2 text-sm text-[#5A5750]">
                Je veux proposer mes services et générer des revenus
              </p>
            </div>
            <div className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Validation requise
            </div>
          </div>
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-[#5A5750]">
          Vous pourrez être à la fois client et prestataire avec le même compte !
        </p>
      </div>

      <div className="text-center">
        <p className="text-sm text-[#5A5750]">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="text-[#2D5BE3] hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [type, setType] = useState<InscriptionType>(null);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        {!type ? (
          <SelectionType onSelect={setType} />
        ) : (
          <div>
            <button
              onClick={() => setType(null)}
              className="mb-6 flex items-center gap-2 text-sm text-[#5A5750] hover:text-[#1A1916] transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Retour
            </button>

            <div className="rounded-lg border bg-card p-6">
              {type === "client" && <RegisterMultiStep />}
              {type === "prestataire" && <RegisterPrestataireMultiStep />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

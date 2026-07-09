"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface KycStats {
  freelancers: {
    en_attente: number;
    valides: number;
    rejetes: number;
    total: number;
  };
  companies: {
    en_attente: number;
    valides: number;
    rejetes: number;
    total: number;
  };
}

export default function KycDashboard() {
  const [stats, setStats] = useState<KycStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Charger les stats des freelances
      const freelancersRes = await fetch("/api/kyc/freelances");
      const freelancersData = await freelancersRes.json();
      const freelancersList = freelancersData.data || [];

      const freelancersStats = {
        en_attente: freelancersList.filter((f: any) => f.statut === "EN_ATTENTE").length,
        valides: freelancersList.filter((f: any) => f.statut === "VALIDE").length,
        rejetes: freelancersList.filter((f: any) => f.statut === "REJETE").length,
        total: freelancersList.length,
      };

      // Charger les stats des entreprises
      const companiesRes = await fetch("/api/kyc/companies");
      const companiesData = await companiesRes.json();
      const companiesList = companiesData.data || [];

      const companiesStats = {
        en_attente: companiesList.filter((c: any) => c.companyVerificationStatus === "EN_ATTENTE").length,
        valides: companiesList.filter((c: any) => c.companyVerificationStatus === "VALIDE").length,
        rejetes: companiesList.filter((c: any) => c.companyVerificationStatus === "REJETE").length,
        total: companiesList.length,
      };

      setStats({
        freelancers: freelancersStats,
        companies: companiesStats,
      });
    } catch (err) {
      console.error("Erreur chargement stats KYC:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh toutes les 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
            <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-[#5A5750]">Chargement des statistiques KYC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1A1916]">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">🪪 KYC et Vérifications</h1>
        <p className="text-[14px] text-[#5A5750] mt-1">
          Gestion centralisée des vérifications d'identité des freelances et des entreprises
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Freelancers Card */}
        <Link href="/admin/kyc/freelances">
          <div className="bg-white border border-[#E2E0D9] rounded-[16px] p-6 hover:border-[#2D5BE3] transition-all cursor-pointer shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1A1916]">Vérifications Freelances</h3>
                <p className="text-[12px] text-[#5A5750] mt-1">Pièces d'identité + Selfies</p>
              </div>
              <div className="text-[32px]">👤</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">En attente de traitement</span>
                <span className="font-semibold text-[#F39C12]">{stats.freelancers.en_attente}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">Validés</span>
                <span className="font-semibold text-[#27AE60]">{stats.freelancers.valides}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">Rejetés</span>
                <span className="font-semibold text-[#E74C3C]">{stats.freelancers.rejetes}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#E2E0D9]">
              <div className="text-[12px] text-[#2D5BE3] font-semibold">
                → Accéder aux vérifications
              </div>
            </div>
          </div>
        </Link>

        {/* Companies Card */}
        <Link href="/admin/kyc/entreprises">
          <div className="bg-white border border-[#E2E0D9] rounded-[16px] p-6 hover:border-[#2D5BE3] transition-all cursor-pointer shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1A1916]">Vérifications Entreprises</h3>
                <p className="text-[12px] text-[#5A5750] mt-1">SIRET, KBIS, RIB</p>
              </div>
              <div className="text-[32px]">🏢</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">En attente de traitement</span>
                <span className="font-semibold text-[#F39C12]">{stats.companies.en_attente}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">Validées</span>
                <span className="font-semibold text-[#27AE60]">{stats.companies.valides}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#5A5750]">Rejetées</span>
                <span className="font-semibold text-[#E74C3C]">{stats.companies.rejetes}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#E2E0D9]">
              <div className="text-[12px] text-[#2D5BE3] font-semibold">
                → Accéder aux vérifications
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Process Info */}
      <div className="bg-[#EEF2FD] border border-[#C3D1F8] rounded-[16px] p-6">
        <h3 className="text-[14px] font-semibold text-[#2D5BE3] mb-3">ℹ️ Workflow de Validation</h3>
        <div className="space-y-2 text-[13px] text-[#1A1916]">
          <div className="flex gap-2">
            <span className="font-semibold min-w-[120px]">Freelances:</span>
            <span>Pièce d'identité + Selfie → Vérification automatique → Vérification humaine → Validation</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold min-w-[120px]">Entreprises:</span>
            <span>SIRET + KBIS + RIB → Vérification automatique → Vérification humaine → Validation</span>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-[13px] text-[#5A5750]">Synchronisation en temps réel activée</span>
          </div>
          <button
            onClick={loadStats}
            className="text-[12px] text-[#2D5BE3] hover:underline font-semibold"
          >
            ↻ Rafraîchir
          </button>
        </div>
      </div>
    </div>
  );
}

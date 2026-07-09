"use client";

import { useState, useEffect } from "react";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    missions: 0,
    volume: 0,
    completion: 0,
    pendingKyc: 0,
    disputes: 0,
    recentActivity: [] as string[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, mRes, pRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/missions"),
          fetch("/api/payments"),
        ]);

        const users = uRes.ok ? await uRes.json() : [];
        const missionsData = mRes.ok ? (await mRes.json()).data ?? (await mRes.json()) : [];
        const paymentsData = pRes.ok ? (await pRes.json()).data ?? (await pRes.json()) : [];

        const userList = Array.isArray(users) ? users : [];
        const missionList = Array.isArray(missionsData) ? missionsData : [];
        const paymentList = Array.isArray(paymentsData) ? paymentsData : [];

        const totalVolume = paymentList.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
        const succeededPayments = paymentList.filter((p: { status: string }) => p.status === "SUCCEEDED").length;
        const totalPayments = paymentList.length;
        const completionRate = totalPayments > 0 ? Math.round((succeededPayments / totalPayments) * 100) : 0;

        // Compter les KYC en attente via la même API que le dashboard KYC
        const kycRes = await fetch("/api/kyc/freelances");
        const kycData = kycRes.ok ? await kycRes.json() : { total: 0 };
        const companiesRes = await fetch("/api/kyc/companies");
        const companiesData = companiesRes.ok ? await companiesRes.json() : { total: 0 };
        const pendingKycCount = (kycData.total || 0) + (companiesData.total || 0);

        // Compter les profils (un utilisateur peut avoir les deux)
        const freelancerCount = userList.filter((u: { freelancerProfile: unknown }) => u.freelancerProfile).length;
        const clientCount = userList.filter((u: { clientProfile: unknown }) => u.clientProfile).length;

        setStats({
          users: userList.length,
          missions: missionList.length,
          volume: totalVolume,
          completion: completionRate,
          pendingKyc: pendingKycCount,
          disputes: 0,
          recentActivity: [
            `${missionList.length} missions disponibles`,
            `${paymentList.length} transactions effectuées`,
            `${freelancerCount} freelances inscrits`,
            `${clientCount} clients inscrits`,
          ],
        });
      } catch {
        // fallback silencieux
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in text-[#1A1916]">
        <div className="mb-2">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Dashboard Admin</h1>
          <p className="text-[14px] text-[#5A5750] mt-1">Chargement des données en cours...</p>
        </div>
        <div className="flex items-stretch bg-white border border-[#E2E0D9] rounded-[16px] overflow-hidden shadow-sm flex-col sm:flex-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-[#FAFAF8] animate-pulse">
              <div className="h-4 w-16 bg-[#E2E0D9] rounded mx-auto mb-2" />
              <div className="h-6 w-12 bg-[#E2E0D9] rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatVolume = (amount: number) => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M €`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K €`;
    return `${amount} €`;
  };

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="mb-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Dashboard Admin</h1>
        <p className="text-[14px] text-[#5A5750] mt-1">Vue d'ensemble de l'activité de la plateforme</p>
      </div>

      <div className="flex items-stretch bg-white border border-[#E2E0D9] rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex-col sm:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-white">
          <span className="text-[18px] mb-1">👥</span>
          <span className="text-[12px] text-center font-medium text-[#5A5750]">Utilisateurs</span>
          <span className="text-[16px] font-bold mt-1 text-[#1A1916]">{stats.users.toLocaleString()}</span>
          <span className="text-[10px] text-[#2D5BE3] mt-0.5">{stats.pendingKyc} en attente KYC</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-white">
          <span className="text-[18px] mb-1">📋</span>
          <span className="text-[12px] text-center font-medium text-[#5A5750]">Missions</span>
          <span className="text-[16px] font-bold mt-1 text-[#1A1916]">{stats.missions.toString()}</span>
          <span className="text-[10px] text-[#9C9A95] mt-0.5">totales crées</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-[#E6F5EE]">
          <span className="text-[18px] mb-1">💶</span>
          <span className="text-[12px] text-center font-medium text-[#1A7A4A]">Volume financier</span>
          <span className="text-[16px] font-bold mt-1 text-[#1A7A4A]">{formatVolume(stats.volume)}</span>
          <span className="text-[10px] text-[#1A7A4A] opacity-80 mt-0.5">toutes transactions</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-[#EEF2FD]">
          <span className="text-[18px] mb-1">📈</span>
          <span className="text-[12px] text-center font-medium text-[#2D5BE3]">Complétion</span>
          <span className="text-[16px] font-bold mt-1 text-[#2D5BE3]">{stats.completion}%</span>
          <span className="text-[10px] text-[#2D5BE3] opacity-80 mt-0.5">paiements réussis</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Résumé de l'Activité */}
        <div className="bg-white border border-[#E2E0D9] rounded-[16px] p-6 shadow-sm flex flex-col">
          <p className="text-[13px] text-[#5A5750] uppercase tracking-[0.04em] font-semibold mb-4 text-center">Vue détaillée</p>
          <div className="grid grid-cols-2 gap-4">
            {stats.recentActivity.map((activity, idx) => (
              <div key={idx} className="bg-[#FAFAF8] border border-[#E2E0D9] rounded-[12px] p-3 text-[12px] text-[#5A5750] text-center">
                {activity}
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div className="bg-white border border-[#E2E0D9] rounded-[16px] p-6 shadow-sm flex flex-col">
          <p className="text-[13px] text-[#5A5750] uppercase tracking-[0.04em] font-semibold mb-4 text-center">Alertes</p>
          <div className="space-y-3 text-sm flex-1 flex flex-col justify-center">
            {stats.disputes > 0 && (
              <div className="rounded-[12px] bg-[#FEF3C7] border border-[#FCD89A] p-3 text-[#B45309] text-[13px] font-medium text-center">
                ⚠️ {stats.disputes} litige(s) en attente de résolution
              </div>
            )}
            {stats.pendingKyc > 0 ? (
              <div className="rounded-[12px] bg-[#EEF2FD] border border-[#C3D1F8] p-3 text-[#2D5BE3] text-[13px] font-medium text-center">
                ℹ️ {stats.pendingKyc} freelance(s) en attente de vérification KYC
              </div>
            ) : (
              <div className="rounded-[12px] bg-[#E6F5EE] border border-[#9FD4B4] p-3 text-[#1A7A4A] text-[13px] font-medium text-center">
                ✅ Aucune alerte en cours
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

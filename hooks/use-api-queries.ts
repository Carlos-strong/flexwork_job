/**
 * Hooks TanStack Query pour les endpoints API les plus utilisés.
 *
 * Architecture plan5.md (section 2) :
 *   Toutes les données API → TanStack Query (cache, revalidation, pagination)
 *
 * Créer un hook par domaine de données, chaque hook encapsulant :
 *   - queryKey via queryKeys factory
 *   - queryFn via apiFetch
 *   - staleTime / gcTime paramétrables
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";

// ═══════════════════════════════════════════════════════════════
// Missions
// ═══════════════════════════════════════════════════════════════

export function useMissionsList(filters?: Record<string, string>) {
  const params = filters ? "?" + new URLSearchParams(filters).toString() : "";
  return useQuery({
    queryKey: queryKeys.missions.list(filters),
    queryFn: () => apiFetch<any[]>(`/api/missions${params}`),
  });
}

export function useMissionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.missions.detail(id),
    queryFn: () => apiFetch<any>(`/api/missions/${id}`),
    enabled: !!id,
  });
}

// ═══════════════════════════════════════════════════════════════
// Applications / Candidatures
// ═══════════════════════════════════════════════════════════════

export function useApplicationsList(filters?: Record<string, string>) {
  const params = filters ? "?" + new URLSearchParams(filters).toString() : "";
  return useQuery({
    queryKey: queryKeys.applications.list(filters),
    queryFn: () => apiFetch<any[]>(`/api/applications${params}`),
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: string; action?: string; reason?: string }) =>
      apiFetch(`/api/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Contrats
// ═══════════════════════════════════════════════════════════════

export function useContractsList() {
  return useQuery({
    queryKey: queryKeys.contracts.all,
    queryFn: () => apiFetch<any[]>("/api/contracts"),
  });
}

export function useContractMilestones(contractId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.milestones(contractId),
    queryFn: () => apiFetch<any[]>(`/api/contracts/${contractId}/milestones`),
    enabled: !!contractId,
  });
}

export function useSubmitMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, milestoneId }: { contractId: string; milestoneId: string }) =>
      apiFetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({ action: "SUBMIT_MILESTONE", milestoneId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.milestones(variables.contractId),
      });
    },
  });
}

export function useApproveMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, milestoneId }: { contractId: string; milestoneId: string }) =>
      apiFetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({ action: "APPROVE_MILESTONE", milestoneId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.milestones(variables.contractId),
      });
    },
  });
}

export function useRejectMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contractId,
      milestoneId,
      rejectionReason,
    }: {
      contractId: string;
      milestoneId: string;
      rejectionReason: string;
    }) =>
      apiFetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({ action: "REJECT_MILESTONE", milestoneId, rejectionReason }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.milestones(variables.contractId),
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Offres
// ═══════════════════════════════════════════════════════════════

export function useClientOffers() {
  return useQuery({
    queryKey: queryKeys.offers.client,
    queryFn: () => apiFetch<any[]>("/api/offers/client"),
  });
}

export function useFreelancerOffers() {
  return useQuery({
    queryKey: queryKeys.offers.freelancer,
    queryFn: () => apiFetch<any[]>("/api/offers/freelancer"),
  });
}

// ═══════════════════════════════════════════════════════════════
// Messages / Conversations
// ═══════════════════════════════════════════════════════════════

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () => apiFetch<any[]>("/api/conversations"),
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: () =>
      apiFetch<any[]>(
        `/api/messages?conversationId=${encodeURIComponent(conversationId)}`
      ),
    enabled: !!conversationId,
    // Rafraîchissement toutes les 5s pour le chat (WebSocket complémentaire)
    refetchInterval: 5000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; content: string }) =>
      apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(variables.conversationId),
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Freelancers (recherche)
// ═══════════════════════════════════════════════════════════════

export function useFreelancerSearch(params: Record<string, string>) {
  const qs = "?" + new URLSearchParams(params).toString();
  return useQuery({
    queryKey: queryKeys.freelancers.search(params),
    queryFn: () => apiFetch<any[]>(`/api/users/freelancers${qs}`),
    enabled: Object.keys(params).length > 0,
  });
}

// ═══════════════════════════════════════════════════════════════
// Profil
// ═══════════════════════════════════════════════════════════════

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: () => apiFetch<any>("/api/users/profile"),
  });
}

// ═══════════════════════════════════════════════════════════════
// Catalogue / Localisation
// ═══════════════════════════════════════════════════════════════

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories,
    queryFn: () => apiFetch<any[]>("/api/categories"),
    staleTime: 1000 * 60 * 5,   // 5 min — rarement modifié
    gcTime: 1000 * 60 * 30,      // 30 min
  });
}

export function useServices(categorieId?: string) {
  const url = categorieId
    ? `/api/services?categorieId=${categorieId}`
    : "/api/services";
  return useQuery({
    queryKey: queryKeys.catalog.services(categorieId),
    queryFn: () => apiFetch<any[]>(url),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePays() {
  return useQuery({
    queryKey: queryKeys.localisation.pays,
    queryFn: () => apiFetch<any[]>("/api/localisation?type=pays"),
    staleTime: 1000 * 60 * 60,  // 1h — presque statique
  });
}

export function useVilles(pays: string) {
  return useQuery({
    queryKey: queryKeys.localisation.villes(pays),
    queryFn: () =>
      apiFetch<any[]>(
        `/api/localisation?type=villes&pays=${encodeURIComponent(pays)}`
      ),
    enabled: !!pays,
    staleTime: 1000 * 60 * 30,
  });
}

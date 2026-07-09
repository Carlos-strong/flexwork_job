"use client";

import React, { useState, useMemo } from "react";
import { ApplicationStatus } from "@prisma/client";
import { ApplicationCard, ApplicationCardProps } from "./ApplicationCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  getNextStates,
} from "@/lib/validations/application-workflow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApplicationListProps {
  applications: ApplicationCardProps[];
  isLoading?: boolean;
  onStatusChange?: (applicationId: string, newStatus: ApplicationStatus) => void;
  onArchive?: (applicationId: string, reason: string) => void;
  onReject?: (applicationId: string, reason: string) => void;
  canManage?: boolean;
}

export function ApplicationList({
  applications,
  isLoading = false,
  onStatusChange,
  onArchive,
  onReject,
  canManage = false,
}: ApplicationListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ApplicationStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "budget">("date");

  // Filtrer et trier les candidatures
  const filtered = useMemo(() => {
    let result = applications.filter((app) => {
      const matchesSearch =
        app.freelancerName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        app.missionTitle
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (app.coverLetter
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ??
          false);

      const matchesStatus =
        activeTab === "all" || app.status === activeTab;

      return matchesSearch && matchesStatus;
    });

    // Trier
    if (sortBy === "budget") {
      result.sort(
        (a, b) => (b.proposedBudget || 0) - (a.proposedBudget || 0)
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [applications, searchTerm, activeTab, sortBy]);

  // Compter par statut
  const countByStatus = useMemo(() => {
    const counts: Record<ApplicationStatus | "all", number> = {
      all: applications.length,
      UNREAD: 0,
      READ: 0,
      PENDING: 0,
      IDENTITY_PENDING: 0,
      SHORTLISTED: 0,
      DISCUSSION: 0,
      INTERVIEW: 0,
      OFFER_SENT: 0,
      OFFER_ACCEPTED: 0,
      OFFER_DECLINED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      ARCHIVED: 0,
    };

    applications.forEach((app) => {
      counts[app.status]++;
    });

    return counts;
  }, [applications]);

  // Statuts à afficher dans les onglets
  const visibleStatuses = [
    "all",
    "UNREAD",
    "SHORTLISTED",
    "DISCUSSION",
    "INTERVIEW",
    "OFFER_SENT",
    "ARCHIVED",
    "REJECTED",
  ] as const;

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher freelancer, mission..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">📅 Plus récent</SelectItem>
            <SelectItem value="budget">💰 Budget max</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Onglets par statut */}
      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as any)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {visibleStatuses.map((status) => (
            <TabsTrigger key={status} value={status}>
              {status === "all"
                ? `Tous (${countByStatus.all})`
                : `${APPLICATION_STATUS_LABELS[status as ApplicationStatus]} (${
                    countByStatus[status as ApplicationStatus]
                  })`}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleStatuses.map((status) => (
          <TabsContent key={status} value={status} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">Aucune candidature trouvée</p>
                <p className="text-sm">
                  {searchTerm
                    ? "Essayez une autre recherche"
                    : "Aucune candidature dans ce statut"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    {...app}
                    isLoading={isLoading}
                    canManage={canManage}
                    onStatusChange={(newStatus) => {
                      onStatusChange?.(app.id, newStatus);
                    }}
                    onArchive={() => {
                      // Modal ou dialog pour demander la raison
                      const reason = prompt(
                        "Raison de l'archivage:"
                      );
                      if (reason) onArchive?.(app.id, reason);
                    }}
                    onReject={() => {
                      const reason = prompt("Raison du refus:");
                      if (reason) onReject?.(app.id, reason);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 border-t pt-4">
        <div>
          <div className="font-semibold text-lg">
            {countByStatus.UNREAD}
          </div>
          <div>À lire</div>
        </div>
        <div>
          <div className="font-semibold text-lg">
            {countByStatus.SHORTLISTED}
          </div>
          <div>Présélectionnés</div>
        </div>
        <div>
          <div className="font-semibold text-lg">
            {countByStatus.OFFER_SENT}
          </div>
          <div>Offres envoyées</div>
        </div>
        <div>
          <div className="font-semibold text-lg">
            {countByStatus.OFFER_ACCEPTED}
          </div>
          <div>Offres acceptées</div>
        </div>
      </div>
    </div>
  );
}

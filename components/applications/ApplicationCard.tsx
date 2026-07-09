"use client";

import React, { useState } from "react";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_ICONS,
  getNextStates,
} from "@/lib/validations/application-workflow";
import { ApplicationStatus } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertCircle, MoreHorizontal, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface ApplicationCardProps {
  id: string;
  freelancerName: string;
  freelancerImage?: string;
  missionTitle: string;
  status: ApplicationStatus;
  proposedBudget?: number;
  coverLetter?: string;
  createdAt: Date;
  onStatusChange?: (newStatus: ApplicationStatus) => void;
  onArchive?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
  canManage?: boolean;
}

export function ApplicationCard({
  id,
  freelancerName,
  freelancerImage,
  missionTitle,
  status,
  proposedBudget,
  coverLetter,
  createdAt,
  onStatusChange,
  onArchive,
  onReject,
  isLoading = false,
  canManage = false,
}: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const nextStates = getNextStates(status);
  const statusLabel = APPLICATION_STATUS_LABELS[status] || status;
  const statusColor = APPLICATION_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
  const statusIcon = APPLICATION_STATUS_ICONS[status] || "📋";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-2xl">{statusIcon}</div>
              <div>
                <CardTitle className="text-lg">{freelancerName}</CardTitle>
                <CardDescription className="mt-1">
                  {missionTitle}
                </CardDescription>
              </div>
            </div>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {nextStates.includes("SHORTLISTED") && (
                  <DropdownMenuItem
                    onClick={() =>
                      onStatusChange?.("SHORTLISTED")
                    }
                    disabled={isLoading}
                  >
                    ⭐ Présélectionner
                  </DropdownMenuItem>
                )}

                {nextStates.includes("DISCUSSION") && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange?.("DISCUSSION")}
                    disabled={isLoading}
                  >
                    💬 Démarrer discussion
                  </DropdownMenuItem>
                )}

                {nextStates.includes("INTERVIEW") && (
                  <DropdownMenuItem
                    onClick={() =>
                      onStatusChange?.("INTERVIEW")
                    }
                    disabled={isLoading}
                  >
                    🎤 Programmer entretien
                  </DropdownMenuItem>
                )}

                {nextStates.includes("OFFER_SENT") && (
                  <DropdownMenuItem
                    onClick={() =>
                      onStatusChange?.("OFFER_SENT")
                    }
                    disabled={isLoading}
                  >
                    📤 Envoyer offre
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {nextStates.includes("ARCHIVED") && (
                  <DropdownMenuItem
                    onClick={onArchive}
                    disabled={isLoading}
                    className="text-gray-600"
                  >
                    📦 Archiver
                  </DropdownMenuItem>
                )}

                {nextStates.includes("REJECTED") && (
                  <DropdownMenuItem
                    onClick={onReject}
                    disabled={isLoading}
                    className="text-red-600"
                  >
                    🚫 Refuser
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge className={statusColor}>{statusLabel}</Badge>
          <span className="text-xs text-gray-500">
            {formatDate(createdAt)}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {proposedBudget && (
          <div className="mb-3 text-sm">
            <span className="font-semibold">Budget proposé:</span>
            <span className="ml-2">{proposedBudget.toLocaleString("fr-FR")} XAF</span>
          </div>
        )}

        {coverLetter && !expanded && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {coverLetter}
          </p>
        )}

        {coverLetter && expanded && (
          <div className="bg-gray-50 p-3 rounded-md mb-3 text-sm border border-gray-200">
            <p className="text-gray-700">{coverLetter}</p>
          </div>
        )}

        {coverLetter && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            {expanded ? "Masquer" : "Afficher plus"}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}

        <div className="mt-4 flex gap-2">
          <Link href={`/dashboard/applications/${id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Voir détails
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

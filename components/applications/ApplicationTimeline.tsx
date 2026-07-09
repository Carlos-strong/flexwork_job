"use client";

import React from "react";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ICONS,
  APPLICATION_STATUS_COLORS,
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
import { Clock, User, MessageSquare } from "lucide-react";

interface StatusHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedBy: string;
  changedByRole: string;
  reason?: string;
  createdAt: Date;
}

interface ApplicationTimelineProps {
  history: StatusHistoryEntry[];
  currentStatus: ApplicationStatus;
}

export function ApplicationTimeline({
  history,
  currentStatus,
}: ApplicationTimelineProps) {
  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const roleColors: Record<string, string> = {
    CLIENT: "bg-blue-100 text-blue-800",
    FREELANCER: "bg-purple-100 text-purple-800",
    ADMIN: "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des statuts</CardTitle>
        <CardDescription>
          Suivi complet des transitions et actions effectuées
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex gap-4 items-start p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="text-3xl pt-1">
              {APPLICATION_STATUS_ICONS[currentStatus] || "📋"}
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-600">
                Statut actuel
              </div>
              <div className="font-semibold text-lg">
                {APPLICATION_STATUS_LABELS[currentStatus]}
              </div>
            </div>
            <Badge
              className={APPLICATION_STATUS_COLORS[currentStatus]}
            >
              {APPLICATION_STATUS_LABELS[currentStatus]}
            </Badge>
          </div>

          {/* Timeline */}
          {sortedHistory.length > 0 ? (
            <div className="relative space-y-3">
              {/* Ligne verticale */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-gray-200" />

              {sortedHistory.map((entry, index) => (
                <div
                  key={entry.id}
                  className="relative pl-16 pb-4"
                >
                  {/* Point sur la timeline */}
                  <div
                    className={`absolute left-1 top-1 w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      index === 0
                        ? "bg-blue-500 ring-4 ring-blue-100"
                        : "bg-gray-300"
                    }`}
                  >
                    {APPLICATION_STATUS_ICONS[
                      entry.toStatus
                    ] || "📝"}
                  </div>

                  {/* Contenu */}
                  <div className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs"
                        >
                          {APPLICATION_STATUS_LABELS[
                            entry.fromStatus
                          ]}{" "}
                          →{" "}
                          {APPLICATION_STATUS_LABELS[
                            entry.toStatus
                          ]}
                        </Badge>
                        <Badge
                          className={roleColors[
                            entry.changedByRole
                          ]}
                        >
                          {entry.changedByRole ===
                          "CLIENT"
                            ? "👤 Client"
                            : entry.changedByRole ===
                                "FREELANCER"
                              ? "👨‍💼 Freelance"
                              : "⚙️ Admin"}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(entry.createdAt)}
                      </div>
                    </div>

                    {entry.reason && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm italic text-gray-700 border-l-2 border-gray-300">
                        {entry.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun historique disponible</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

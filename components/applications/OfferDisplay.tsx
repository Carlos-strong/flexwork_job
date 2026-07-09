"use client";

import React, { useState } from "react";
import { OfferStatus, OfferType } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
} from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: string;
  dueDate?: Date;
}

interface OfferDisplayProps {
  id: string;
  title: string;
  description?: string;
  offerType: OfferType;
  totalBudget?: number;
  hourlyRate?: number;
  weeklyHourLimit?: number;
  startDate: Date;
  endDate?: Date;
  status: OfferStatus;
  sentAt?: Date;
  expiresAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  milestones?: Milestone[];
  onAccept?: (offerId: string) => void;
  onDecline?: (offerId: string, reason: string) => void;
  isLoading?: boolean;
  showActions?: boolean;
}

export function OfferDisplay({
  id,
  title,
  description,
  offerType,
  totalBudget,
  hourlyRate,
  weeklyHourLimit,
  startDate,
  endDate,
  status,
  sentAt,
  expiresAt,
  acceptedAt,
  declinedAt,
  declineReason: propDeclineReason,
  milestones = [],
  onAccept,
  onDecline,
  isLoading = false,
  showActions = false,
}: OfferDisplayProps) {
  const [declineDialogOpen, setDeclineDialogOpen] =
    useState(false);
  const [declineReasonInput, setDeclineReasonInput] = useState("");

  const statusColors: Record<OfferStatus, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    SENT: "bg-blue-100 text-blue-800",
    COUNTERED: "bg-orange-100 text-orange-800",
    ACCEPTED: "bg-green-100 text-green-800",
    DECLINED: "bg-red-100 text-red-800",
    EXPIRED: "bg-orange-100 text-orange-800",
    WITHDRAWN: "bg-gray-100 text-gray-800",
  };

  const statusLabels: Record<OfferStatus, string> = {
    DRAFT: "Brouillon",
    SENT: "Envoyée",
    COUNTERED: "Contre-proposition",
    ACCEPTED: "Acceptée",
    DECLINED: "Refusée",
    EXPIRED: "Expirée",
    WITHDRAWN: "Retirée",
  };

  const isExpired =
    expiresAt && new Date() > new Date(expiresAt);
  const daysUntilExpiry = expiresAt
    ? Math.ceil(
        (new Date(expiresAt).getTime() -
          new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {offerType === "FIXED" ? (
                  <DollarSign className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-blue-600" />
                )}
                <CardTitle>{title}</CardTitle>
              </div>
              {description && (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Type et Budget */}
          <div className="grid grid-cols-2 gap-4">
            {offerType === "FIXED" ? (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm text-gray-600">
                  Montant fixe
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {totalBudget?.toLocaleString("fr-FR", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  XAF
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-gray-600">
                    Taux horaire
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {hourlyRate?.toLocaleString("fr-FR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    XAF
                  </div>
                </div>
                {weeklyHourLimit && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-sm text-gray-600">
                      Limite hebdo
                    </div>
                    <div className="text-2xl font-bold text-purple-700">
                      {weeklyHourLimit}h/sem
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Calendar className="h-4 w-4 text-gray-600" />
            <div className="text-sm">
              <span className="font-semibold">
                {new Date(startDate).toLocaleDateString(
                  "fr-FR"
                )}
              </span>
              {endDate && (
                <>
                  {" - "}
                  <span className="font-semibold">
                    {new Date(endDate).toLocaleDateString(
                      "fr-FR"
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Jalons (FIXED only) */}
          {offerType === "FIXED" && milestones.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-semibold">
                Jalons de paiement
              </div>
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {milestone.title}
                    </div>
                    {milestone.dueDate && (
                      <div className="text-xs text-gray-500">
                        Avant le{" "}
                        {new Date(
                          milestone.dueDate
                        ).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-sm">
                    {milestone.amount.toLocaleString(
                      "fr-FR"
                    )}{" "}
                    XAF
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expiration alert */}
          {status === "SENT" && expiresAt && (
            <Alert
              className={
                isExpired
                  ? "border-red-200 bg-red-50"
                  : daysUntilExpiry === 0 ||
                      daysUntilExpiry === 1
                    ? "border-orange-200 bg-orange-50"
                    : "border-blue-200 bg-blue-50"
              }
            >
              <AlertCircle
                className={`h-4 w-4 ${
                  isExpired
                    ? "text-red-600"
                    : daysUntilExpiry === 0 ||
                        daysUntilExpiry === 1
                      ? "text-orange-600"
                      : "text-blue-600"
                }`}
              />
              <AlertDescription
                className={
                  isExpired
                    ? "text-red-700"
                    : daysUntilExpiry === 0 ||
                        daysUntilExpiry === 1
                      ? "text-orange-700"
                      : "text-blue-700"
                }
              >
                {isExpired
                  ? "Cette offre a expiré"
                  : `${daysUntilExpiry} jour(s) avant expiration`}
              </AlertDescription>
            </Alert>
          )}

          {/* Décision */}
          {acceptedAt && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-semibold text-green-900">
                  Offre acceptée
                </div>
                <div className="text-xs text-green-700">
                  {new Date(acceptedAt).toLocaleDateString(
                    "fr-FR"
                  )}
                </div>
              </div>
            </div>
          )}

          {declinedAt && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-900">
                  Offre refusée
                </div>
                {propDeclineReason && (
                  <div className="text-xs text-red-700 mt-1">
                    {propDeclineReason}
                  </div>
                )}
                <div className="text-xs text-red-600">
                  {new Date(declinedAt).toLocaleDateString(
                    "fr-FR"
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && status === "SENT" && !isExpired && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={() => onAccept?.(id)}
                disabled={isLoading}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Accepter
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeclineDialogOpen(true)}
                disabled={isLoading}
                className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Refuser
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decline Dialog */}
      <Dialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser l'offre</DialogTitle>
            <DialogDescription>
              Dites-nous pourquoi vous refusez cette offre
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Motif du refus (ex: budget insuffisant, délai trop court...)"
            value={declineReasonInput}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeclineReasonInput(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeclineDialogOpen(false)
              }
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDecline?.(id, declineReasonInput);
                setDeclineDialogOpen(false);
              }}
              disabled={isLoading}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

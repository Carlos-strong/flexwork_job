"use client";

import React, { useState } from "react";
import { InterviewFormat } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  Phone,
  AlertCircle,
  Star,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const InterviewSchema = z.object({
  format: z.enum(["CHAT", "VIDEO_CALL", "PHONE", "MEETING"]),
  scheduledAt: z.string().optional(),
  duration: z.number().optional(),
  notes: z.string().optional(),
});

const CompleteInterviewSchema = z.object({
  feedbackByClient: z.string().optional(),
  feedbackByFreelancer: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

type InterviewFormData = z.infer<typeof InterviewSchema>;
type CompleteInterviewData = z.infer<typeof CompleteInterviewSchema>;

interface InterviewManagerProps {
  applicationId: string;
  interview?: {
    id: string;
    format: InterviewFormat;
    scheduledAt?: Date;
    duration?: number;
    notes?: string;
    completedAt?: Date;
    feedbackByClient?: string;
    feedbackByFreelancer?: string;
    rating?: number;
  };
  onSchedule?: (interview: any) => void;
  onComplete?: (interview: any) => void;
  isLoading?: boolean;
}

export function InterviewManager({
  applicationId,
  interview,
  onSchedule,
  onComplete,
  isLoading = false,
}: InterviewManagerProps) {
  const [mode, setMode] = useState<"schedule" | "complete" | "view">(
    interview ? "view" : "schedule"
  );

  const scheduleForm = useForm<InterviewFormData>({
    resolver: zodResolver(InterviewSchema),
    defaultValues: {
      format: interview?.format || "CHAT",
      scheduledAt: interview?.scheduledAt
        ? new Date(interview.scheduledAt)
            .toISOString()
            .split("T")[0]
        : undefined,
      duration: interview?.duration || 60,
      notes: interview?.notes,
    },
  });

  const completeForm = useForm<CompleteInterviewData>({
    resolver: zodResolver(CompleteInterviewSchema),
    defaultValues: {
      feedbackByClient: interview?.feedbackByClient,
      feedbackByFreelancer: interview?.feedbackByFreelancer,
      rating: interview?.rating,
    },
  });

  const formatIcon: Record<InterviewFormat, React.ReactNode> = {
    CHAT: <MessageSquare className="h-4 w-4" />,
    VIDEO_CALL: <Video className="h-4 w-4" />,
    PHONE: <Phone className="h-4 w-4" />,
    MEETING: <Calendar className="h-4 w-4" />,
  };

  const formatLabel: Record<InterviewFormat, string> = {
    CHAT: "Discussion textuelle",
    VIDEO_CALL: "Appel vidéo",
    PHONE: "Appel téléphonique",
    MEETING: "Réunion",
  };

  async function onScheduleSubmit(data: InterviewFormData) {
    try {
      const response = await fetch(
        `/api/applications/${applicationId}/interview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) throw new Error("Failed to schedule interview");

      const result = await response.json();
      onSchedule?.(result.interview);
      setMode("view");
    } catch (error) {
      console.error("Error scheduling interview:", error);
    }
  }

  async function onCompleteSubmit(data: CompleteInterviewData) {
    try {
      if (!interview?.id) return;

      const response = await fetch(
        `/api/applications/${applicationId}/interview/${interview.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) throw new Error("Failed to complete interview");

      const result = await response.json();
      onComplete?.(result.interview);
      setMode("view");
    } catch (error) {
      console.error("Error completing interview:", error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {formatIcon[interview?.format || "CHAT"]}
          {interview
            ? `${formatLabel[interview.format]}`
            : "Programmer un entretien"}
        </CardTitle>
        <CardDescription>
          {interview
            ? interview.completedAt
              ? "Entretien complété"
              : "Entretien programmé"
            : "Sélectionnez un format et programmez l'entretien"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {mode === "view" && interview ? (
          <div className="space-y-4">
            {/* Format */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div>{formatIcon[interview.format]}</div>
              <div>
                <div className="text-sm text-gray-600">Format</div>
                <div className="font-semibold">
                  {formatLabel[interview.format]}
                </div>
              </div>
            </div>

            {/* Date & Heure */}
            {interview.scheduledAt && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Calendar className="h-4 w-4" />
                <div>
                  <div className="text-sm text-gray-600">Planifié pour</div>
                  <div className="font-semibold">
                    {new Date(
                      interview.scheduledAt
                    ).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Durée */}
            {interview.duration && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <Clock className="h-4 w-4" />
                <div>
                  <div className="text-sm text-gray-600">Durée estimée</div>
                  <div className="font-semibold">
                    {interview.duration} minutes
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {interview.notes && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-sm text-gray-600 mb-1">
                  Notes
                </div>
                <div className="text-sm">{interview.notes}</div>
              </div>
            )}

            {/* Statut complété */}
            {interview.completedAt && (
              <>
                <Alert className="border-green-200 bg-green-50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Entretien complété le{" "}
                    {new Date(interview.completedAt).toLocaleDateString(
                      "fr-FR"
                    )}
                  </AlertDescription>
                </Alert>

                {/* Rating */}
                {interview.rating && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">
                      Note
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= (interview.rating ?? 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback client */}
                {interview.feedbackByClient && (
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-semibold mb-2">
                      Avis du client
                    </div>
                    <div className="text-sm text-gray-700">
                      {interview.feedbackByClient}
                    </div>
                  </div>
                )}

                {/* Feedback freelance */}
                {interview.feedbackByFreelancer && (
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-semibold mb-2">
                      Avis du freelance
                    </div>
                    <div className="text-sm text-gray-700">
                      {interview.feedbackByFreelancer}
                    </div>
                  </div>
                )}

                {/* Bouton pour modifier le feedback */}
                <Button
                  variant="outline"
                  onClick={() => setMode("complete")}
                  className="w-full"
                >
                  Modifier les retours
                </Button>
              </>
            )}

            {!interview.completedAt && (
              <Button
                onClick={() => setMode("complete")}
                className="w-full"
              >
                Compléter l'entretien
              </Button>
            )}
          </div>
        ) : mode === "schedule" ? (
          <Form {...scheduleForm}>
            <form
              onSubmit={scheduleForm.handleSubmit(
                onScheduleSubmit
              )}
              className="space-y-4"
            >
              <FormField
                control={scheduleForm.control}
                name="format"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Format d'entretien</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(formatLabel).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {
                                  formatIcon[
                                    key as InterviewFormat
                                  ]
                                }
                                {label}
                              </div>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleForm.control}
                name="scheduledAt"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Date et heure (optionnel)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour définir ultérieurement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleForm.control}
                name="duration"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Durée (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="60"
                        {...field}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.onChange(
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleForm.control}
                name="notes"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Notes (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Points à couvrir, liens de call vidéo, etc."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={scheduleForm.formState.isSubmitting}
                className="w-full"
              >
                {scheduleForm.formState.isSubmitting
                  ? "Programmation..."
                  : "Programmer l'entretien"}
              </Button>
            </form>
          </Form>
        ) : (
          /* Mode complétion */
          <Form {...completeForm}>
            <form
              onSubmit={completeForm.handleSubmit(
                onCompleteSubmit
              )}
              className="space-y-4"
            >
              <FormField
                control={completeForm.control}
                name="rating"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Note (1-5 étoiles)</FormLabel>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-8 w-8 cursor-pointer transition-colors ${
                              star <=
                              (field.value || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300 hover:text-yellow-200"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={completeForm.control}
                name="feedbackByClient"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Votre avis (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Partagez vos impressions sur cet entretien..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={completeForm.control}
                name="feedbackByFreelancer"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>
                      Avis du freelance (optionnel)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Avis du freelance (à remplir après l'entretien)..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      À remplir ultérieurement par le freelance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("view")}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={completeForm.formState.isSubmitting}
                  className="flex-1"
                >
                  {completeForm.formState.isSubmitting
                    ? "Enregistrement..."
                    : "Enregistrer les retours"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Plus,
  Trash2,
  Send,
  DollarSign,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validation schema
const MilestoneSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  amount: z.number().min(0.01, "Le montant doit être > 0"),
  dueDate: z.string().optional(),
});

const OfferSchema = z.object({
  title: z.string().min(3, "Le titre doit faire au moins 3 caractères"),
  description: z.string().optional(),
  offerType: z.enum(["FIXED", "HOURLY"]),
  totalBudget: z.number().optional(),
  hourlyRate: z.number().optional(),
  weeklyHourLimit: z.number().optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().optional(),
  milestones: z.array(MilestoneSchema).optional(),
});

type OfferFormData = z.infer<typeof OfferSchema>;

interface OfferFormProps {
  applicationId: string;
  onSuccess?: (offerId: string) => void;
  onSend?: (offerId: string) => void;
  isLoading?: boolean;
}

export function OfferForm({
  applicationId,
  onSuccess,
  onSend,
  isLoading = false,
}: OfferFormProps) {
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [offerId, setOfferId] = useState<string | null>(null);
  const [step, setStep] = useState<"create" | "review" | "sent">("create");

  const form = useForm<OfferFormData>({
    resolver: zodResolver(OfferSchema),
    defaultValues: {
      offerType: "FIXED",
      startDate: new Date().toISOString().split("T")[0],
      milestones: [],
    },
  });

  const {
    fields: milestoneFields,
    append: appendMilestone,
    remove: removeMilestone,
  } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const offerType = form.watch("offerType");
  const totalBudget = form.watch("totalBudget");
  const milestones = form.watch("milestones") || [];

  // Calculer le total des jalons
  const milestoneTotal = milestones.reduce(
    (sum, m) => sum + (m.amount || 0),
    0
  );

  // Auto-save du brouillon toutes les 5s (plan5.md §4)
  const watchedData = form.watch();
  const { restored, clearDraft, hasSavedDraft } = useAutoSave(
    `offer-${applicationId}`,
    watchedData as Record<string, unknown>
  );
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (restored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      form.reset({ ...form.formState.defaultValues, ...restored });
    }
  }, [restored]);

  async function onSubmit(data: OfferFormData) {
    try {
      setSubmitStatus({ type: null, message: "" });

      const response = await fetch(
        `/api/applications/${applicationId}/offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create offer");
      }

      const result = await response.json();
      setOfferId(result.offer.id);
      setStep("review");
      clearDraft();
      onSuccess?.(result.offer.id);

      setSubmitStatus({
        type: "success",
        message: "Offre créée avec succès!",
      });
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue",
      });
    }
  }

  async function handleSend() {
    if (!offerId) return;

    try {
      setSubmitStatus({ type: null, message: "" });

      const response = await fetch(`/api/offers/${offerId}?action=send`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send offer");
      }

      setStep("sent");
      onSend?.(offerId);

      setSubmitStatus({
        type: "success",
        message: "Offre envoyée avec succès!",
      });
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue",
      });
    }
  }

  if (step === "sent") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="text-3xl">✅</div>
            <div>
              <CardTitle>Offre envoyée!</CardTitle>
              <CardDescription>
                Le freelance a 7 jours pour accepter
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === "create" ? "Créer une offre" : "Vérifier l'offre"}
        </CardTitle>
        <CardDescription>
          {step === "create"
            ? "Proposez des conditions de travail au freelance"
            : "Vérifiez les détails avant d'envoyer"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {submitStatus.type && (
          <Alert
            className={
              submitStatus.type === "error"
                ? "border-red-200 bg-red-50 mb-4"
                : "border-green-200 bg-green-50 mb-4"
            }
          >
            <AlertCircle
              className={`h-4 w-4 ${
                submitStatus.type === "error"
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            />
            <AlertDescription
              className={
                submitStatus.type === "error"
                  ? "text-red-700"
                  : "text-green-700"
              }
            >
              {submitStatus.message}
            </AlertDescription>
          </Alert>
        )}

        {step === "create" ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Bannière de brouillon restauré */}
              {hasSavedDraft && (
                <div className="rounded-[10px] border border-[#FCD89A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E] flex items-center gap-2">
                  <span>📝</span>
                  <span><strong>Brouillon restauré</strong> — vous pouvez reprendre où vous vous êtes arrêté.</span>
                </div>
              )}
              {/* Basique */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Titre de l'offre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex: Développement Frontend React"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Détails supplémentaires sur la mission..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type offre */}
              <FormField
                control={form.control}
                name="offerType"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Type d'offre</FormLabel>
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
                        <SelectItem value="FIXED">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Montant fixe
                          </div>
                        </SelectItem>
                        <SelectItem value="HOURLY">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Taux horaire
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget ou Taux */}
              {offerType === "FIXED" ? (
                <FormField
                  control={form.control}
                  name="totalBudget"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Montant total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            field.onChange(
                              parseFloat(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Montant total en XAF
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>Taux horaire</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              field.onChange(
                                parseFloat(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          En XAF par heure
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weeklyHourLimit"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>
                          Limite hebdomadaire (optionnel)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="40"
                            min="0"
                            {...field}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              field.onChange(
                                parseInt(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Heures max par semaine
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Date de fin (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Jalons (FIXED uniquement) */}
              {offerType === "FIXED" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Jalons de paiement</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendMilestone({
                          title: "",
                          amount: 0,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter jalon
                    </Button>
                  </div>

                  {milestoneFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-3 p-4 border rounded-lg"
                    >
                      <FormField
                        control={form.control}
                        name={`milestones.${index}.title`}
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>Titre</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Phase 1, Phase 2..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`milestones.${index}.amount`}
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>Montant</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  field.onChange(
                                    parseFloat(
                                      e.target.value
                                    )
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          removeMilestone(index)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {milestones.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span>Total jalons:</span>
                        <span className="font-semibold">
                          {milestoneTotal.toLocaleString(
                            "fr-FR"
                          )}{" "}
                          XAF
                        </span>
                      </div>
                      {totalBudget && (
                        <div className="flex justify-between mt-2 text-xs text-gray-600">
                          <span>Budget total:</span>
                          <span>
                            {totalBudget.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            XAF
                          </span>
                        </div>
                      )}
                      {totalBudget && milestoneTotal > totalBudget && (
                        <div className="text-red-600 mt-2">
                          ⚠️ Total jalons {`>`} budget
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  isLoading || form.formState.isSubmitting
                }
                className="w-full"
              >
                {form.formState.isSubmitting
                  ? "Création..."
                  : "Créer l'offre"}
              </Button>
            </form>
          </Form>
        ) : (
          /* Étape Review */
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="text-sm text-gray-600">Titre</div>
                <div className="font-semibold">
                  {form.getValues("title")}
                </div>
              </div>

              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="text-sm text-gray-600">Type</div>
                <Badge variant="outline">
                  {form.getValues("offerType") === "FIXED"
                    ? "Montant fixe"
                    : "Taux horaire"}
                </Badge>
              </div>

              {form.getValues("offerType") === "FIXED" ? (
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="text-sm text-gray-600">
                    Montant total
                  </div>
                  <div className="font-semibold text-lg">
                    {form
                      .getValues("totalBudget")
                      ?.toLocaleString("fr-FR")}{" "}
                    XAF
                  </div>
                </div>
              ) : (
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="text-sm text-gray-600">
                    Taux horaire
                  </div>
                  <div className="font-semibold text-lg">
                    {form
                      .getValues("hourlyRate")
                      ?.toLocaleString("fr-FR")}{" "}
                    XAF/h
                  </div>
                </div>
              )}

              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <div className="text-sm text-gray-600">
                  Période
                </div>
                <div>
                  {new Date(
                    form.getValues("startDate")
                  ).toLocaleDateString("fr-FR")}{" "}
                  →{" "}
                  {form.getValues("endDate")
                    ? new Date(
                        form.getValues("endDate") as string
                      ).toLocaleDateString("fr-FR")
                    : "Indéfinie"}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("create")}
              >
                ← Retour
              </Button>
              <Button
                onClick={handleSend}
                disabled={isLoading}
                className="flex-1 gap-2"
              >
                <Send className="h-4 w-4" />
                Envoyer l'offre
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { z } from "zod";

export const createApplicationSchema = z.object({
  missionId: z.string(),
  freelancerId: z.string(),
  coverLetter: z.string().min(10, "La lettre de motivation doit contenir au moins 10 caractères"),
  proposedBudget: z.number().min(1, "Un budget proposé est requis"),
});

export const updateApplicationSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

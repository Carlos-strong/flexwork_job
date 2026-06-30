import { z } from "zod";

export const freelancerProfileSchema = z.object({
  title: z.string().min(2, "Le titre professionnel est requis"),
  bio: z.string().optional(),
  hourlyRate: z.number().min(1, "Le taux horaire est requis"),
  skills: z.string().min(1, "Au moins une compétence requise"),
  availability: z.enum(["full-time", "part-time", "weekends"]),
  location: z.string().optional(),
  portfolio: z.string().url("URL invalide").optional().or(z.literal("")),
  experience: z.string().optional(),
});

export const clientProfileSchema = z.object({
  companyName: z.string().optional(),
  companySector: z.string().optional(),
  description: z.string().optional(),
});

export type FreelancerProfileInput = z.infer<typeof freelancerProfileSchema>;
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;

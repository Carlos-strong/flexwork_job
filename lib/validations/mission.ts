import { z } from "zod";

export const createMissionSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères"),
  description: z.string().min(20, "La description doit contenir au moins 20 caractères"),
  budget: z.number().min(100, "Le budget minimum est de 100 €"),
  currency: z.string().default("EUR"),
  skills: z.array(z.string()).min(1, "Au moins une compétence requise"),
  duration: z.string().optional(),
  location: z.string().default("Remote"),
});

export const updateMissionSchema = createMissionSchema.partial();

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;

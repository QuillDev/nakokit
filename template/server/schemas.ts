import { z } from "zod";

export const DatabaseEngineSchema = z.enum(["sqlite", "postgres", "none"]);
export type DatabaseEngine = z.infer<typeof DatabaseEngineSchema>;

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  name: z.string(),
  version: z.string(),
  database: DatabaseEngineSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const PingRowSchema = z.object({
  ok: z.coerce.number().refine((v) => v === 1, "Expected health query to return 1"),
});

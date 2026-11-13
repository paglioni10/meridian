import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  ALLOWED_EMAILS: z.string().min(3),
  CRON_SECRET: optional(z.string().min(32)),
  ALERT_WEBHOOK_URL: optional(z.url()),
  ALERT_WEBHOOK_SECRET: optional(z.string().min(32)),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

export function serverEnv() {
  return serverSchema.parse(process.env);
}

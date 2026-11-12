import { z } from "zod";
import { parseBRL } from "@/lib/money";

function toCents(value: string, ctx: z.RefinementCtx): number {
  const cents = parseBRL(value);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "Use um valor positivo, ex.: 1.234,56" });
    return z.NEVER;
  }
  return cents;
}

export const requiredMoney = (message = "Informe o valor") =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform((v, ctx) => toCents(v, ctx));

export const optionalMoney = z
  .string()
  .trim()
  .transform((v, ctx) => (v === "" ? null : toCents(v, ctx)));

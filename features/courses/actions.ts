"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COURSE_STATUSES, courseInputSchema, normalizeCourseLinks, type CourseField } from "./schema";

export type CourseFormState = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Partial<Record<CourseField, string>>;
  values?: Record<string, string>;
};

async function resolveCategoryId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_categories")
    .upsert({ user_id: user.id, name }, { onConflict: "user_id,name" })
    .select("id")
    .single();
  if (error) throw new Error("Não foi possível salvar a categoria.");
  return data.id;
}

export async function saveCourse(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const submitted: Record<string, string> = Object.fromEntries(
    [
      "id",
      "title",
      "url",
      "provider",
      "category",
      "context",
      "priority",
      "status",
      "estimated_hours",
      "progress_pct",
      "obsidian_note",
    ].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const raw = normalizeCourseLinks(submitted);
  const parsed = courseInputSchema.safeParse({ ...raw, progress_pct: raw.progress_pct || "0" });

  if (!parsed.success) {
    const fieldErrors: CourseFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as CourseField;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors, values: raw };
  }

  const user = await getCurrentUser();
  const { id, category, ...values } = parsed.data;

  try {
    const category_id = await resolveCategoryId(category);
    const supabase = await createClient();
    const payload = { ...values, category_id, user_id: user.id };
    const { error } = id
      ? await supabase.from("courses").update(payload).eq("id", id)
      : await supabase.from("courses").insert(payload);
    if (error) {
      console.error("[courses] save falhou", { code: error.code, message: error.message });
      return { status: "error", message: "Não foi possível salvar o curso.", values: raw };
    }
  } catch (e) {
    return { status: "error", message: (e as Error).message, values: raw };
  }

  refresh();
  return { status: "saved", message: id ? "Curso atualizado." : "Curso adicionado." };
}

const idSchema = z.uuid();

export async function setCourseStatus(id: string, status: string) {
  const parsed = z.object({ id: idSchema, status: z.enum(COURSE_STATUSES) }).parse({ id, status });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ status: parsed.status }).eq("id", parsed.id);
  if (error) throw new Error("Não foi possível mudar o status.");
  refresh();
}

export async function setCourseProgress(id: string, progress: number) {
  const parsed = z
    .object({ id: idSchema, progress: z.number().int().min(0).max(100) })
    .parse({ id, progress });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ progress_pct: parsed.progress })
    .eq("id", parsed.id);
  if (error) throw new Error("Não foi possível salvar o progresso.");
  refresh();
}

export async function deleteCourse(id: string) {
  const parsedId = idSchema.parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", parsedId);
  if (error) throw new Error("Não foi possível excluir o curso.");
  refresh();
}

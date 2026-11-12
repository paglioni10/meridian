import "server-only";
import { getCurrentUser } from "@/lib/auth";
import type { AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export async function getGoals(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("goal_progress", { p_context: context });
  if (error) throw new Error(`Falha ao carregar objetivos: ${error.message}`);
  return data;
}

export type GoalRow = Awaited<ReturnType<typeof getGoals>>[number];

export async function getGoalDetails(goalIds: string[]) {
  await getCurrentUser();
  if (goalIds.length === 0) return { milestones: [], contributions: [] };
  const supabase = await createClient();
  const [milestones, contributions] = await Promise.all([
    supabase
      .from("goal_milestones")
      .select("id, goal_id, title, position, done_at")
      .in("goal_id", goalIds)
      .order("position")
      .order("created_at"),
    supabase
      .from("goal_contributions")
      .select("id, goal_id, amount_cents, contributed_on, note")
      .in("goal_id", goalIds)
      .order("contributed_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (milestones.error) throw new Error(`Falha ao carregar marcos: ${milestones.error.message}`);
  if (contributions.error) throw new Error(`Falha ao carregar aportes: ${contributions.error.message}`);
  return { milestones: milestones.data, contributions: contributions.data };
}

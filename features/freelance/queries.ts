import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getDeals() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, title, stage, value_cents, expected_close_on, closed_at, lost_reason, income_id, client_id, client:clients(name), projects(id)",
    )
    .order("position")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar negócios: ${error.message}`);
  return data;
}

export type DealRow = Awaited<ReturnType<typeof getDeals>>[number];

export async function getClientsWithTotals() {
  await getCurrentUser();
  const supabase = await createClient();
  const [clients, deals, projects, expenses] = await Promise.all([
    supabase.from("clients").select("id, name, company, email, phone, notes").order("name"),
    supabase.from("deals").select("client_id, stage, value_cents"),
    supabase.from("projects").select("id, deal:deals(client_id)").not("deal_id", "is", null),
    supabase.from("expenses").select("project_id, amount_cents").not("project_id", "is", null),
  ]);
  if (clients.error) throw new Error(`Falha ao carregar clientes: ${clients.error.message}`);
  if (deals.error || projects.error || expenses.error)
    throw new Error("Falha ao calcular os totais dos clientes.");

  const projectClient = new Map(
    projects.data.map((p) => [p.id, p.deal?.client_id ?? null] as const).filter(([, c]) => c),
  );

  return clients.data.map((c) => {
    const own = deals.data.filter((d) => d.client_id === c.id);
    const revenue = own.filter((d) => d.stage === "won").reduce((s, d) => s + (d.value_cents ?? 0), 0);
    const costs = expenses.data
      .filter((e) => e.project_id && projectClient.get(e.project_id) === c.id)
      .reduce((s, e) => s + e.amount_cents, 0);
    return {
      ...c,
      deals: own.length,
      openDeals: own.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
      revenue,
      costs,
      margin: revenue - costs,
    };
  });
}

export type ClientRow = Awaited<ReturnType<typeof getClientsWithTotals>>[number];

export async function getReminders() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_reminders")
    .select(
      "id, client_id, deal_id, amount_cents, remind_on, recurrence, day_of_month, note, last_paid_on, client:clients(name), deal:deals(title)",
    )
    .is("done_at", null)
    .order("remind_on");
  if (error) throw new Error(`Falha ao carregar cobranças: ${error.message}`);
  return data;
}

export type ReminderRow = Awaited<ReturnType<typeof getReminders>>[number];

import { describe, expect, it } from "vitest";
import { billingAlert, nextMonthly, reminderStatus } from "@/features/freelance/billing";
import { reminderInputSchema, reminderPaidSchema } from "@/features/freelance/schema";

const UUID = "aaaaaaaa-0000-4000-8000-000000000001";

describe("lembretes de cobrança", () => {
  it("status pela data", () => {
    expect(reminderStatus("2026-11-10", "2026-11-13")).toBe("late");
    expect(reminderStatus("2026-11-13", "2026-11-13")).toBe("today");
    expect(reminderStatus("2026-11-20", "2026-11-13")).toBe("soon");
    expect(reminderStatus("2026-11-21", "2026-11-13")).toBe("later");
  });

  it("próximo mês mantém o dia e ajusta meses curtos", () => {
    expect(nextMonthly("2026-11-05", 5)).toBe("2026-12-05");
    expect(nextMonthly("2026-12-05", 5)).toBe("2027-01-05");
    expect(nextMonthly("2027-01-31", 31)).toBe("2027-02-28");
    expect(nextMonthly("2027-02-28", 31)).toBe("2027-03-31");
  });

  it("alerta no dia e depois uma vez por semana enquanto atrasado", () => {
    const r = { id: "r1", remind_on: "2026-11-13" };
    expect(billingAlert(r, "2026-11-12")).toBeNull();
    expect(billingAlert(r, "2026-11-13")).toEqual({ dedupe: "billing:r1:2026-11-13:w0", daysLate: 0 });
    expect(billingAlert(r, "2026-11-19")?.dedupe).toBe("billing:r1:2026-11-13:w0");
    expect(billingAlert(r, "2026-11-20")?.dedupe).toBe("billing:r1:2026-11-13:w1");
  });

  it("formulário", () => {
    const base = {
      id: "",
      client_id: UUID,
      deal_id: "",
      amount_cents: "1.800,00",
      remind_on: "2026-12-20",
      recurrence: "monthly",
      note: "",
    };
    expect(reminderInputSchema.parse(base)).toMatchObject({
      deal_id: null,
      amount_cents: 180000,
      note: null,
    });
    expect(reminderInputSchema.parse({ ...base, amount_cents: "" }).amount_cents).toBeNull();
    expect(reminderInputSchema.safeParse({ ...base, client_id: "" }).error?.issues[0]?.message).toBe(
      "Escolha o cliente",
    );
    expect(reminderInputSchema.safeParse({ ...base, recurrence: "weekly" }).success).toBe(false);
    expect(
      reminderPaidSchema.parse({ id: UUID, source_id: "", received_on: "2026-12-20" }).source_id,
    ).toBeNull();
  });
});

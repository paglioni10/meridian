import { describe, expect, it } from "vitest";
import {
  classifyProbe,
  daysBetween,
  estimateBalance,
  heartbeatState,
  isDue,
  nextExpiry,
  parseRdapExpiration,
  projectCreditExpiry,
  rdapUrl,
  renewalAlert,
  signBody,
  tlsAlertDedupe,
  transitionAlert,
} from "@/features/infra/rules";
import { alertDaysSchema, renewalInputSchema, serviceInputSchema } from "@/features/infra/schema";

const ok = { ok: true, statusCode: 200, latencyMs: 120, keywordFound: null, error: null };

describe("classifyProbe", () => {
  it("up, lento, status errado, palavra ausente e sem resposta", () => {
    expect(classifyProbe(ok, 200, 1500).state).toBe("up");
    expect(classifyProbe({ ...ok, latencyMs: 2400 }, 200, 1500)).toEqual({
      state: "degraded",
      error: "Resposta em 2400 ms",
    });
    expect(classifyProbe({ ...ok, statusCode: 502 }, 200, 1500).error).toBe("Status 502, esperado 200");
    expect(classifyProbe({ ...ok, statusCode: 301 }, 301, 1500).state).toBe("up");
    expect(classifyProbe({ ...ok, keywordFound: false }, 200, 1500).state).toBe("down");
    expect(
      classifyProbe(
        { ok: false, statusCode: null, latencyMs: null, keywordFound: null, error: "ECONNREFUSED" },
        200,
        1500,
      ),
    ).toEqual({ state: "down", error: "ECONNREFUSED" });
  });
});

describe("agenda e heartbeat", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  it("isDue respeita o intervalo com folga de 30 s", () => {
    expect(isDue(null, 10, now)).toBe(true);
    expect(isDue("2026-11-15T11:50:20Z", 10, now)).toBe(true);
    expect(isDue("2026-11-15T11:55:00Z", 10, now)).toBe(false);
  });
  it("heartbeat cai após 2× o intervalo", () => {
    expect(heartbeatState(null, 10, now)).toBeNull();
    expect(heartbeatState("2026-11-15T11:45:00Z", 10, now)).toBeNull();
    expect(heartbeatState("2026-11-15T11:39:00Z", 10, now)).toBe("down");
  });
  it("alerta só na transição para e a partir de offline", () => {
    expect(transitionAlert("up", "down")).toEqual({ kind: "service_down" });
    expect(transitionAlert("unknown", "down")).toEqual({ kind: "service_down" });
    expect(transitionAlert("down", "down")).toBeNull();
    expect(transitionAlert("down", "up")).toEqual({ kind: "service_up" });
    expect(transitionAlert("down", "degraded")).toEqual({ kind: "service_up" });
    expect(transitionAlert("unknown", "up")).toBeNull();
    expect(transitionAlert("up", "degraded")).toBeNull();
  });
});

describe("vencimentos", () => {
  it("renova pelo ciclo a partir do vencimento ou de hoje", () => {
    expect(nextExpiry("2026-12-10", "yearly", "2026-11-15")).toBe("2027-12-10");
    expect(nextExpiry("2026-01-31", "monthly", "2026-01-20")).toBe("2026-02-28");
    expect(nextExpiry("2026-10-01", "monthly", "2026-11-15")).toBe("2026-12-15");
    expect(nextExpiry("2028-02-29", "yearly", "2028-01-01")).toBe("2029-02-28");
  });

  it("projeta e estima crédito pré-pago", () => {
    expect(projectCreditExpiry(2500, 709, "2026-11-01")).toBe("2027-02-16");
    expect(estimateBalance(2500, 709, "2026-11-01", "2026-12-01")).toBe(
      2500 - Math.round((709 * 30) / 30.4375),
    );
    expect(estimateBalance(100, 709, "2026-01-01", "2026-12-01")).toBe(0);
    expect(daysBetween("2026-11-15", "2026-11-10")).toBe(-5);
  });

  const base = {
    id: "r1",
    kind: "domain",
    expires_on: "2026-11-20",
    alert_days: [30, 7, 1],
    auto_renew: false,
  };

  it("um alerta por limiar, deduplicado pela data de vencimento", () => {
    expect(renewalAlert(base, "2026-11-15")).toEqual({
      kind: "renewal_due",
      dedupe: "renewal:r1:2026-11-20:7d",
      daysLeft: 5,
    });
    expect(renewalAlert(base, "2026-11-19")?.dedupe).toBe("renewal:r1:2026-11-20:1d");
    expect(renewalAlert(base, "2026-09-01")).toBeNull();
    expect(renewalAlert(base, "2026-11-22")).toEqual({
      kind: "renewal_expired",
      dedupe: "renewal:r1:2026-11-20:expired",
      daysLeft: -2,
    });
  });

  it("renovação automática silencia, exceto crédito acabando", () => {
    expect(renewalAlert({ ...base, auto_renew: true }, "2026-11-15")).toBeNull();
    expect(renewalAlert({ ...base, kind: "credit", auto_renew: true }, "2026-11-15")?.kind).toBe(
      "credit_low",
    );
  });

  it("certificado TLS avisa com 14, 7 e 1 dia", () => {
    expect(tlsAlertDedupe("s1", "2026-12-31", "2026-11-15")).toBeNull();
    expect(tlsAlertDedupe("s1", "2026-11-25", "2026-11-15")).toBe("tls:s1:2026-11-25:14d");
  });
});

describe("RDAP", () => {
  it("monta a URL certa por TLD", () => {
    expect(rdapUrl("meusite.com.br")).toBe("https://rdap.registro.br/domain/meusite.com.br");
    expect(rdapUrl("https://Exemplo.com/caminho")).toBe("https://rdap.org/domain/exemplo.com");
    expect(rdapUrl("não é domínio")).toBeNull();
  });
  it("lê o evento de expiração", () => {
    const body = {
      events: [
        { eventAction: "registration", eventDate: "2020-01-10T00:00:00Z" },
        { eventAction: "expiration", eventDate: "2027-01-10T00:00:00Z" },
      ],
    };
    expect(parseRdapExpiration(body)).toBe("2027-01-10");
    expect(parseRdapExpiration({ events: [] })).toBeNull();
    expect(parseRdapExpiration("x")).toBeNull();
  });
});

describe("formulários", () => {
  const service = {
    id: "",
    name: "VPS",
    kind: "vps",
    provider: "",
    url: "https://vps.test/healthz",
    check_method: "http",
    expected_status: "200",
    keyword: "",
    latency_warn_ms: "1500",
    interval_minutes: "10",
    context: "freelance",
    active: "on",
    notes: "",
  };

  it("serviço HTTP exige URL; keyword exige texto; heartbeat dispensa URL", () => {
    expect(serviceInputSchema.parse(service)).toMatchObject({
      active: true,
      expected_status: 200,
      provider: null,
    });
    expect(serviceInputSchema.safeParse({ ...service, url: "" }).error?.issues[0]?.path).toEqual(["url"]);
    expect(
      serviceInputSchema.safeParse({ ...service, check_method: "keyword" }).error?.issues[0]?.message,
    ).toBe("Informe o texto esperado na página");
    expect(serviceInputSchema.safeParse({ ...service, check_method: "heartbeat", url: "" }).success).toBe(
      true,
    );
    expect(serviceInputSchema.safeParse({ ...service, interval_minutes: "2" }).success).toBe(false);
  });

  it("dias de aviso: padrão, ordenação e limites", () => {
    expect(alertDaysSchema.parse("")).toEqual([30, 7, 1]);
    expect(alertDaysSchema.parse("1, 30;7 7")).toEqual([30, 7, 1]);
    expect(alertDaysSchema.safeParse("400").success).toBe(false);
  });

  it("crédito exige saldo, consumo e data; outros exigem vencimento", () => {
    const renewal = {
      id: "",
      kind: "credit",
      name: "Hetzner",
      provider: "",
      service_id: "",
      context: "freelance",
      expires_on: "",
      currency: "USD",
      cost_cents: "",
      billing_cycle: "other",
      balance_cents: "25,00",
      monthly_burn_cents: "7,09",
      balance_updated_on: "2026-11-01",
      owner_is_client: "",
      auto_renew: "",
      alert_days: "",
      notes: "",
    };
    expect(renewalInputSchema.parse(renewal)).toMatchObject({ balance_cents: 2500, monthly_burn_cents: 709 });
    expect(renewalInputSchema.safeParse({ ...renewal, balance_cents: "" }).success).toBe(false);
    expect(renewalInputSchema.safeParse({ ...renewal, kind: "domain" }).error?.issues[0]?.path).toEqual([
      "expires_on",
    ]);
  });
});

describe("assinatura do webhook", () => {
  it("HMAC-SHA256 do corpo em hex com prefixo", () => {
    expect(signBody("{}", "segredo")).toBe(
      "sha256=fb628fffaa33657454b42caedf691bd6a3ecb2b2f1e32a33d1f916632fa09b20",
    );
  });
});

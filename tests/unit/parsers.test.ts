import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyTransaction, DEFAULT_CATEGORIES, matchRule } from "@/features/expenses/classify";
import { parseStatement, transactionHash } from "@/lib/parsers/statement";
import { normalizeDescription, parseCsv, parseStatementAmount, parseStatementDate } from "@/lib/parsers/text";
import { StatementError } from "@/lib/parsers/types";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));

describe("parseStatementAmount", () => {
  it.each([
    ["-50.00", -5000],
    ["5200.00", 520000],
    ["1.234,56", 123456],
    ["-1,5", -150],
    ["R$ 23,90", 2390],
    ["−10.00", -1000],
    ["1,234.56", 123456],
  ])("%s vira %d", (input, expected) => {
    expect(parseStatementAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "1.2.3,4", "12,345"])("rejeita %s", (input) => {
    expect(parseStatementAmount(input)).toBeNull();
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["05/11/2026", "2026-11-05"],
    ["2026-11-05", "2026-11-05"],
    ["20261105000000[-3:BRT]", "2026-11-05"],
  ])("%s vira %s", (input, expected) => {
    expect(parseStatementDate(input)).toBe(expected);
  });

  it.each(["31/11/2026", "20261131", "11/05/26", ""])("rejeita %s", (input) => {
    expect(parseStatementDate(input)).toBeNull();
  });
});

describe("parseCsv", () => {
  it("respeita aspas, vírgulas internas, aspas escapadas e CRLF", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("CSV da conta Nubank", () => {
  const s = parseStatement(fixture("nubank-conta.csv"));

  it("detecta formato, período e linhas inválidas", () => {
    expect(s.format).toBe("nubank_account_csv");
    expect(s.kind).toBe("account");
    expect(s.transactions).toHaveLength(7);
    expect(s.invalidLines).toBe(1);
    expect([s.periodStart, s.periodEnd]).toEqual(["2026-11-01", "2026-11-15"]);
  });

  it("mantém sinal, acentos, id e vírgula entre aspas", () => {
    const [salary, , bread] = s.transactions;
    expect(salary).toMatchObject({ amountCents: 520000, externalId: "6a1f0c00-0000-4000-8000-000000000001" });
    expect(bread.description).toBe("Compra no débito - PADARIA PÃO QUENTE");
    expect(bread.normalized).toBe("compra no debito - padaria pao quente");
    expect(s.transactions[6].description).toBe("Pagamento de boleto efetuado - HETZNER ONLINE, GMBH");
  });

  it("duas compras idênticas no mesmo dia geram hashes diferentes", () => {
    const [a, b] = s.transactions.slice(2, 4);
    expect([a.ordinal, b.ordinal]).toEqual([0, 1]);
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).toBe(transactionHash(a.date, a.amountCents, a.normalized, 0));
  });

  it("reimportar o mesmo conteúdo gera os mesmos hashes", () => {
    const again = parseStatement(fixture("nubank-conta.csv"));
    expect(again.transactions.map((t) => t.hash)).toEqual(s.transactions.map((t) => t.hash));
  });
});

describe("CSV do cartão Nubank", () => {
  const s = parseStatement(fixture("nubank-cartao.csv"));

  it("inverte o sinal: compra vira saída e pagamento vira entrada", () => {
    expect(s.format).toBe("nubank_card_csv");
    expect(s.kind).toBe("card");
    expect(s.transactions.map((t) => t.amountCents)).toEqual([-5840, -2315, -5590, -21000, 183045, 2315]);
    expect(s.transactions.every((t) => t.externalId === null)).toBe(true);
  });
});

describe("OFX", () => {
  it("lê OFX SGML em Windows-1252 com entidades e descarta data inválida", () => {
    const s = parseStatement(fixture("nubank-conta.ofx"));
    expect(s.format).toBe("ofx");
    expect(s.kind).toBe("account");
    expect(s.invalidLines).toBe(1);
    expect(s.transactions[1]).toMatchObject({
      date: "2026-11-05",
      amountCents: -2390,
      description: "Compra no débito - PADARIA PÃO QUENTE & CIA",
      externalId: "6a1f0c00-0000-4000-8000-000000000003",
    });
  });

  it("lê OFX XML de cartão", () => {
    const s = parseStatement(fixture("nubank-cartao.ofx"));
    expect(s.kind).toBe("card");
    expect(s.transactions.map((t) => [t.amountCents, t.externalId])).toEqual([
      [-5840, "card-0001"],
      [183045, "card-0002"],
    ]);
  });
});

describe("erros de arquivo", () => {
  it.each([
    [new Uint8Array(), "O arquivo está vazio."],
    [new TextEncoder().encode("nome,idade\nana,30"), "Formato não reconhecido"],
    [new TextEncoder().encode("Data,Valor,Identificador,Descrição\n"), "Nenhuma transação encontrada"],
  ])("rejeita com mensagem clara", (bytes, message) => {
    expect(() => parseStatement(bytes)).toThrow(StatementError);
    expect(() => parseStatement(bytes)).toThrow(message);
  });

  it("rejeita arquivo maior que 2 MB", () => {
    expect(() => parseStatement(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow("2 MB");
  });
});

describe("classificação", () => {
  const categories = [
    { id: "moradia", nature: "fixed" as const },
    { id: "alimentacao", nature: "variable" as const },
    { id: "mercado", nature: "variable" as const },
  ];
  const rules = [
    { pattern: "padaria", categoryId: "alimentacao" },
    { pattern: "mercado", categoryId: "mercado" },
    { pattern: "supermercado bom", categoryId: "alimentacao" },
  ];
  const recurring = [{ id: "aluguel", matchPattern: "imobiliaria lar", categoryId: "moradia" }];
  const tx = (description: string, amountCents: number) => ({
    amountCents,
    normalized: normalizeDescription(description),
  });

  it("regra mais longa vence", () => {
    expect(matchRule("supermercado bom preco", rules)).toBe("alimentacao");
    expect(matchRule("mercado x", rules)).toBe("mercado");
  });

  it("débito vira despesa com categoria pela regra", () => {
    expect(
      classifyTransaction(tx("Compra no débito - PADARIA", -2390), "account", rules, categories, []),
    ).toMatchObject({
      action: "expense",
      categoryId: "alimentacao",
      nature: "variable",
    });
  });

  it("vincula à despesa fixa e marca como fixa", () => {
    expect(
      classifyTransaction(
        tx("Transferência enviada pelo Pix - IMOBILIARIA LAR", -150000),
        "account",
        rules,
        categories,
        recurring,
      ),
    ).toMatchObject({ action: "expense", recurringId: "aluguel", categoryId: "moradia", nature: "fixed" });
  });

  it.each([
    ["Pagamento de fatura", -183045, "account", "ignore"],
    ["Aplicação RDB", -50000, "account", "ignore"],
    ["Transferência recebida pelo Pix - EMPRESA X", 520000, "account", "income"],
    ["Resgate RDB", 50000, "account", "ignore"],
    ["Estorno - Uber", 2315, "account", "ignore"],
    ["Pagamento recebido", 183045, "card", "ignore"],
    ["Netflix.Com", -5590, "card", "expense"],
  ] as const)("%s → %s", (description, amount, kind, action) => {
    expect(classifyTransaction(tx(description, amount), kind, rules, categories, recurring).action).toBe(
      action,
    );
  });

  it("padrões sugeridos são minúsculos e sem acento, como exige o banco", () => {
    for (const c of DEFAULT_CATEGORIES) {
      for (const p of c.patterns) expect(p).toBe(normalizeDescription(p));
    }
  });
});

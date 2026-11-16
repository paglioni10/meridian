"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  archiveAsset,
  deleteTransaction,
  refreshQuotes,
  saveAsset,
  saveTargets,
  saveTransaction,
  testQuote,
  updateAssetValue,
  type ActionState,
} from "@/features/investments/actions";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASSES,
  rebalance,
  type AssetClass,
} from "@/features/investments/rebalance";
import { MODE_LABELS, SOURCE_LABELS, TX_LABELS, TX_TYPES, type TxType } from "@/features/investments/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS, type ContextKind } from "@/lib/context";
import { formatDateFull } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";

const initial: ActionState = { status: "idle", message: "" };
const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 });
const price = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

export type Option = { id: string; name: string };

export type PositionItem = {
  id: string;
  context: ContextKind;
  ticker_or_name: string;
  asset_class: AssetClass;
  institution: string | null;
  valuation_mode: "quote" | "balance";
  quote_source: "brapi" | "coingecko" | "manual";
  quote_symbol: string | null;
  quantity: number;
  avg_price: number;
  invested_cents: number;
  current_price: number | null;
  price_updated_at: string | null;
  linked_goal_id: string | null;
  equity_cents: number;
};

export type ClassItem = {
  class: AssetClass;
  assets: number;
  equity_cents: number;
  current_pct: number;
  target_pct: number;
  gap_cents: number;
};

export type TransactionItem = {
  id: string;
  type: TxType;
  quantity: number | null;
  unit_price: number | null;
  total_amount_cents: number;
  occurred_on: string;
  notes: string | null;
  asset: string;
};

function useResult(state: ActionState, onDone: () => void) {
  const toast = useToast();
  const onResult = useEffectEvent((r: ActionState) => {
    if (r.status === "saved") {
      toast(r.message);
      onDone();
    }
    if (r.status === "error" && !r.fieldErrors) toast(r.message, "alert");
  });
  useEffect(() => {
    onResult(state);
  }, [state]);
}

function FormActions({
  onCancel,
  pending,
  label,
}: {
  onCancel: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="modal-actions">
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Salvando" : label}
      </Button>
    </div>
  );
}

function AssetForm({ value, goals, onDone }: { value?: PositionItem; goals: Option[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveAsset, initial);
  useResult(state, onDone);
  const toast = useToast();
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [mode, setMode] = useState(v("valuation_mode", value?.valuation_mode ?? "quote"));
  const [source, setSource] = useState(v("quote_source", value?.quote_source ?? "brapi"));
  const [symbol, setSymbol] = useState(v("quote_symbol", value?.quote_symbol ?? ""));
  const [testing, startTest] = useTransition();
  const effectiveSource = mode === "balance" ? "manual" : source;

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ativo" error={e.ticker_or_name}>
          {(a) => (
            <Input
              {...a}
              name="ticker_or_name"
              defaultValue={v("ticker_or_name", value?.ticker_or_name ?? "")}
              placeholder="IVVB11, Caixinha Viagem"
              autoFocus
            />
          )}
        </Field>
        <Field label="Classe" error={e.asset_class}>
          {(a) => (
            <Select
              {...a}
              name="asset_class"
              defaultValue={v("asset_class", value?.asset_class ?? "fixed_income")}
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CLASS_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Instituição" error={e.institution}>
          {(a) => (
            <Input
              {...a}
              name="institution"
              defaultValue={v("institution", value?.institution ?? "")}
              placeholder="Nubank"
            />
          )}
        </Field>
        <Field label="Como avaliar" error={e.valuation_mode}>
          {(a) => (
            <Select {...a} name="valuation_mode" value={mode} onChange={(ev) => setMode(ev.target.value)}>
              <option value="quote">{MODE_LABELS.quote}</option>
              <option value="balance">{MODE_LABELS.balance}</option>
            </Select>
          )}
        </Field>
      </div>
      {mode === "quote" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fonte da cotação" error={e.quote_source}>
            {(a) => (
              <Select {...a} name="quote_source" value={source} onChange={(ev) => setSource(ev.target.value)}>
                {(["brapi", "coingecko", "manual"] as const).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Símbolo"
            error={e.quote_symbol}
            hint={source === "coingecko" ? "ID da CoinGecko, ex.: bitcoin" : "Ticker da B3, ex.: IVVB11"}
          >
            {(a) => (
              <div className="flex gap-2">
                <Input
                  {...a}
                  name="quote_symbol"
                  value={symbol}
                  onChange={(ev) => setSymbol(ev.target.value)}
                  disabled={source === "manual"}
                />
                {source !== "manual" ? (
                  <Button
                    variant="ghost"
                    className="shrink-0"
                    disabled={testing || !symbol}
                    onClick={() =>
                      startTest(async () => {
                        const p = await testQuote(source, symbol).catch(() => null);
                        toast(
                          p ? `Cotação: R$ ${price.format(p)}` : "Cotação não encontrada.",
                          p ? undefined : "alert",
                        );
                      })
                    }
                  >
                    Testar
                  </Button>
                ) : null}
              </div>
            )}
          </Field>
        </div>
      ) : null}
      {mode === "balance" || source === "manual" ? (
        <>
          <input type="hidden" name="quote_source" value={effectiveSource} />
          <input type="hidden" name="quote_symbol" value="" />
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Objetivo vinculado"
          error={e.linked_goal_id}
          hint="O objetivo passa a usar o valor deste ativo"
        >
          {(a) => (
            <Select
              {...a}
              name="linked_goal_id"
              defaultValue={v("linked_goal_id", value?.linked_goal_id ?? "")}
            >
              <option value="">Nenhum</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", value?.context ?? "personal")}>
              {(["personal", "work", "freelance"] as const).map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Cadastrar"} />
    </form>
  );
}

function TransactionForm({
  assets,
  assetId,
  today,
  onDone,
}: {
  assets: PositionItem[];
  assetId?: string;
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveTransaction, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [asset, setAsset] = useState(v("asset_id", assetId ?? assets[0]?.id ?? ""));
  const [type, setType] = useState<TxType>((state.values?.type as TxType) ?? "contribution");
  const selected = assets.find((a) => a.id === asset);
  const trade = selected?.valuation_mode === "quote" && (type === "contribution" || type === "withdrawal");

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ativo" error={e.asset_id}>
          {(a) => (
            <Select {...a} name="asset_id" value={asset} onChange={(ev) => setAsset(ev.target.value)}>
              {assets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ticker_or_name}
                  {p.institution ? ` · ${p.institution}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tipo" error={e.type}>
          {(a) => (
            <Select {...a} name="type" value={type} onChange={(ev) => setType(ev.target.value as TxType)}>
              {TX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TX_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Data" error={e.occurred_on}>
          {(a) => <Input {...a} name="occurred_on" type="date" defaultValue={v("occurred_on", today)} />}
        </Field>
        {trade ? (
          <>
            <Field label="Quantidade" error={e.quantity}>
              {(a) => <Input {...a} name="quantity" inputMode="decimal" defaultValue={v("quantity", "")} />}
            </Field>
            <Field label="Preço unitário (R$)" error={e.unit_price}>
              {(a) => (
                <Input {...a} name="unit_price" inputMode="decimal" defaultValue={v("unit_price", "")} />
              )}
            </Field>
          </>
        ) : (
          <>
            <input type="hidden" name="quantity" value="" />
            <input type="hidden" name="unit_price" value="" />
          </>
        )}
        <Field
          label="Total (R$)"
          error={e.total_amount_cents}
          hint={trade ? "Vazio = quantidade × preço; preencha para incluir taxas" : undefined}
        >
          {(a) => (
            <Input
              {...a}
              name="total_amount_cents"
              inputMode="decimal"
              defaultValue={v("total_amount_cents", "")}
            />
          )}
        </Field>
      </div>
      <Field label="Observação" error={e.notes}>
        {(a) => <Input {...a} name="notes" defaultValue={v("notes", "")} />}
      </Field>
      <FormActions onCancel={onDone} pending={pending} label="Lançar" />
    </form>
  );
}

function ValueForm({ asset, onDone }: { asset: PositionItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateAssetValue, initial);
  useResult(state, onDone);
  const balance = asset.valuation_mode === "balance";
  const current = balance ? asset.equity_cents : Math.round((asset.current_price ?? asset.avg_price) * 100);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={asset.id} />
      <Field
        label={balance ? "Saldo atual (R$)" : "Cotação atual (R$)"}
        error={state.fieldErrors?.value_cents}
        hint={
          balance ? "O valor que aparece no app do banco hoje" : "Use quando não houver cotação automática"
        }
      >
        {(a) => (
          <Input
            {...a}
            name="value_cents"
            inputMode="decimal"
            defaultValue={state.values?.value_cents ?? (current ? formatBRL(current) : "")}
            autoFocus
          />
        )}
      </Field>
      <FormActions onCancel={onDone} pending={pending} label="Atualizar" />
    </form>
  );
}

function TargetsForm({
  targets,
  onDone,
}: {
  targets: Partial<Record<AssetClass, number>>;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveTargets, initial);
  useResult(state, onDone);
  const [values, setValues] = useState<Record<AssetClass, string>>(
    () =>
      Object.fromEntries(
        ASSET_CLASSES.map((c) => [c, state.values?.[c] ?? String(targets[c] ?? 0)]),
      ) as Record<AssetClass, string>,
  );
  const total = ASSET_CLASSES.reduce((s, c) => s + (Number(values[c].replace(",", ".")) || 0), 0);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {ASSET_CLASSES.map((c) => (
        <Field key={c} label={`${ASSET_CLASS_LABELS[c]} (%)`} error={state.fieldErrors?.[c]}>
          {(a) => (
            <Input
              {...a}
              name={c}
              inputMode="decimal"
              value={values[c]}
              onChange={(ev) => setValues((v) => ({ ...v, [c]: ev.target.value }))}
            />
          )}
        </Field>
      ))}
      <p className={cn("font-mono text-data tabular-nums", total > 100 && "text-danger")}>
        Total {pct(total)}
        {total < 100 ? ` · faltam ${pct(100 - total)}` : total > 100 ? " · acima de 100%" : ""}
      </p>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || total > 100}>
          {pending ? "Salvando" : "Salvar metas"}
        </Button>
      </div>
    </form>
  );
}

export function HeadActions({
  assets,
  goals,
  targets,
  today,
}: {
  assets: PositionItem[];
  goals: Option[];
  targets: Partial<Record<AssetClass, number>>;
  today: string;
}) {
  const [dialog, setDialog] = useState<"asset" | "tx" | "targets" | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const hasQuotes = assets.some((a) => a.quote_source !== "manual");
  return (
    <>
      <Button variant="primary" onClick={() => setDialog("asset")}>
        Novo ativo
      </Button>
      {assets.length ? <Button onClick={() => setDialog("tx")}>Lançar movimento</Button> : null}
      <Button onClick={() => setDialog("targets")}>Metas de alocação</Button>
      {hasQuotes ? (
        <Button
          variant="ghost"
          aria-busy={pending}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const r = await refreshQuotes();
                toast(
                  r.failed.length
                    ? `${r.updated} atualizadas · falharam: ${r.failed.join(", ")}`
                    : r.updated
                      ? `${r.updated} cotações atualizadas.`
                      : "Cotações já estão recentes.",
                  r.failed.length ? "alert" : undefined,
                );
              } catch {
                toast("Não foi possível atualizar as cotações.", "alert");
              }
            })
          }
        >
          {pending ? "Atualizando" : "Atualizar cotações"}
        </Button>
      ) : null}
      <Dialog open={dialog === "asset"} onClose={() => setDialog(null)} title="Novo ativo">
        {dialog === "asset" ? <AssetForm goals={goals} onDone={() => setDialog(null)} /> : null}
      </Dialog>
      <Dialog open={dialog === "tx"} onClose={() => setDialog(null)} title="Lançar movimento">
        {dialog === "tx" ? (
          <TransactionForm assets={assets} today={today} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "targets"} onClose={() => setDialog(null)} title="Metas de alocação">
        {dialog === "targets" ? <TargetsForm targets={targets} onDone={() => setDialog(null)} /> : null}
      </Dialog>
    </>
  );
}

export function AllocationBars({ classes, equityCents }: { classes: ClassItem[]; equityCents: number }) {
  const [amount, setAmount] = useState("");
  const hasTargets = classes.some((c) => c.target_pct > 0);
  const cents = parseBRL(amount) ?? 0;
  const suggestion = hasTargets
    ? rebalance(
        classes.map((c) => ({ class: c.class, equity_cents: c.equity_cents, target_pct: c.target_pct })),
        cents,
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {classes.map((c) => {
          const over = c.target_pct > 0 && c.current_pct - c.target_pct > 5;
          return (
            <li key={c.class} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-label uppercase">{ASSET_CLASS_LABELS[c.class]}</span>
                <span className="font-mono text-label tabular-nums">
                  {pct(c.current_pct)}
                  {hasTargets ? <span className="text-muted"> · meta {pct(c.target_pct)}</span> : null}
                </span>
              </div>
              <div
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(c.current_pct)}
                aria-valuetext={`${ASSET_CLASS_LABELS[c.class]} ${pct(c.current_pct)}${hasTargets ? `, meta ${pct(c.target_pct)}` : ""}`}
                className="relative h-2 w-full border-b border-border-soft"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-foreground"
                  style={{ width: `${Math.min(100, c.current_pct)}%` }}
                />
                {hasTargets && c.target_pct > 0 ? (
                  <span
                    className="absolute -top-1 -bottom-1 w-0.5 bg-secondary"
                    style={{ left: `calc(${Math.min(100, c.target_pct)}% - 1px)` }}
                  />
                ) : null}
              </div>
              {hasTargets ? (
                <span
                  className={cn("font-mono text-label tabular-nums", over ? "text-danger" : "text-muted")}
                >
                  {c.target_pct === 0 && c.equity_cents === 0
                    ? "Sem meta"
                    : c.gap_cents > 100
                      ? `Aportar ${formatBRL(c.gap_cents)}`
                      : over
                        ? `Acima +${(c.current_pct - c.target_pct).toFixed(1).replace(".", ",")} p.p.`
                        : "Na meta"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hasTargets && equityCents >= 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-soft pt-3">
          <label className="field">
            <span className="field-label">Simular próximo aporte (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.000,00"
            />
          </label>
          {suggestion.length ? (
            <ul className="flex flex-col gap-1 font-mono text-data tabular-nums">
              {suggestion.map((s) => (
                <li key={s.class} className="flex justify-between">
                  <span>{ASSET_CLASS_LABELS[s.class]}</span>
                  <span>{formatBRL(s.cents)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="label">Defina metas de alocação para ver onde fazer o próximo aporte.</p>
      )}
    </div>
  );
}

function variation(p: PositionItem) {
  if (!p.invested_cents) return null;
  return ((p.equity_cents - p.invested_cents) / p.invested_cents) * 100;
}

function PositionRow({
  position,
  assets,
  goals,
  today,
  staleDays,
}: {
  position: PositionItem;
  assets: PositionItem[];
  goals: Option[];
  today: string;
  staleDays: number | null;
}) {
  const [dialog, setDialog] = useState<"tx" | "value" | "edit" | "archive" | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const v = variation(position);
  const quote = position.valuation_mode === "quote";
  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2.5", pending && "opacity-60")}>
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <span className="min-w-0 truncate">
          <span className="font-mono">{position.ticker_or_name}</span>
          <span className="text-muted">{position.institution ? ` · ${position.institution}` : ""}</span>
        </span>
        <span className="hidden font-mono text-data text-muted tabular-nums md:block">
          {quote ? qty.format(position.quantity) : "—"}
        </span>
        <span className="hidden font-mono text-data text-muted tabular-nums md:block">
          {quote ? price.format(position.avg_price) : "—"}
        </span>
        <span className="hidden font-mono text-data tabular-nums md:block">
          {quote
            ? position.current_price !== null
              ? price.format(position.current_price)
              : "sem cotação"
            : "saldo"}
        </span>
        <span className="text-right font-mono text-data tabular-nums">
          {formatBRL(position.equity_cents)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          {ASSET_CLASS_LABELS[position.asset_class]}
          {v !== null ? ` · ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%` : ""}
          {position.linked_goal_id ? " · vinculado a objetivo" : ""}
        </span>
        {staleDays !== null && staleDays > 3 && position.price_updated_at ? (
          <Tag tone="outline">
            {quote ? "Cotação" : "Saldo"} de {formatDateFull(position.price_updated_at)}
          </Tag>
        ) : null}
      </div>
      <span className="-ml-2 flex flex-wrap">
        <Button variant="ghost" className="min-h-9" onClick={() => setDialog("tx")}>
          Lançar
        </Button>
        {!quote || position.quote_source === "manual" ? (
          <Button variant="ghost" className="min-h-9" onClick={() => setDialog("value")}>
            {quote ? "Informar cotação" : "Atualizar saldo"}
          </Button>
        ) : null}
        <Button variant="ghost" className="min-h-9" onClick={() => setDialog("edit")}>
          Editar
        </Button>
        <Button variant="ghost" className="min-h-9" onClick={() => setDialog("archive")}>
          Arquivar
        </Button>
      </span>
      <Dialog
        open={dialog === "tx"}
        onClose={() => setDialog(null)}
        title={`Lançar · ${position.ticker_or_name}`}
      >
        {dialog === "tx" ? (
          <TransactionForm
            assets={assets}
            assetId={position.id}
            today={today}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "value"} onClose={() => setDialog(null)} title={position.ticker_or_name}>
        {dialog === "value" ? <ValueForm asset={position} onDone={() => setDialog(null)} /> : null}
      </Dialog>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar ativo">
        {dialog === "edit" ? (
          <AssetForm value={position} goals={goals} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog
        open={dialog === "archive"}
        onClose={() => setDialog(null)}
        title="Arquivar ativo?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialog(null);
                startTransition(async () => {
                  try {
                    await archiveAsset(position.id);
                    toast("Ativo arquivado.");
                  } catch (err) {
                    toast((err as Error).message, "alert");
                  }
                });
              }}
            >
              Arquivar
            </Button>
          </>
        }
      >
        <p>
          <strong>{position.ticker_or_name}</strong> sai da carteira e do patrimônio. O histórico de
          movimentações é mantido.
        </p>
      </Dialog>
    </li>
  );
}

export function Portfolio({
  positions,
  goals,
  today,
  staleDays,
}: {
  positions: PositionItem[];
  goals: Option[];
  today: string;
  staleDays: Record<string, number | null>;
}) {
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-x-4 border-b border-border pb-1 font-mono text-label text-muted uppercase md:grid">
        <span>Ativo</span>
        <span>Qtd</span>
        <span>Preço médio</span>
        <span>Cotação</span>
        <span className="text-right">Valor</span>
      </div>
      <ul className="flex flex-col">
        {positions.map((p) => (
          <PositionRow
            key={p.id}
            position={p}
            assets={positions}
            goals={goals}
            today={today}
            staleDays={staleDays[p.id] ?? null}
          />
        ))}
      </ul>
    </div>
  );
}

export function TransactionList({ items }: { items: TransactionItem[] }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <ul className={cn("flex flex-col", pending && "opacity-60")}>
      {items.map((t) => (
        <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2">
          <span className="min-w-0 truncate">
            <span className="mr-2 font-mono text-label text-muted uppercase">{TX_LABELS[t.type]}</span>
            {t.asset}
            {t.quantity ? <span className="text-muted"> · {qty.format(t.quantity)} un.</span> : null}
          </span>
          <span className="flex shrink-0 items-baseline gap-3">
            <span className="font-mono text-data tabular-nums">
              {t.type === "withdrawal" ? "−" : ""}
              {formatBRL(t.total_amount_cents)}
            </span>
            <span className="font-mono text-label text-muted">{formatDateFull(t.occurred_on)}</span>
            <button
              type="button"
              className="font-mono text-label text-danger uppercase"
              aria-label={`Excluir ${TX_LABELS[t.type]} de ${t.asset}`}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await deleteTransaction(t.id);
                    toast("Movimentação excluída.");
                  } catch (err) {
                    toast((err as Error).message, "alert");
                  }
                })
              }
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

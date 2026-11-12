"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  applyRulesToUncategorized,
  deleteCategory,
  deleteRecurring,
  deleteRule,
  saveCategory,
  saveRecurring,
  saveRule,
  seedDefaultCategories,
  type ActionState,
} from "@/features/expenses/actions";
import {
  CONTEXT_KINDS,
  NATURES,
  NATURE_LABELS,
  type ContextKind,
  type ExpenseNature,
} from "@/features/expenses/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatBRL } from "@/lib/money";

const initial: ActionState = { status: "idle", message: "" };

function useFormResult(state: ActionState, onDone: () => void) {
  const toast = useToast();
  const onResult = useEffectEvent((result: ActionState) => {
    if (result.status === "saved") {
      toast(result.message);
      onDone();
    }
    if (result.status === "error" && !result.fieldErrors) toast(result.message, "alert");
  });
  useEffect(() => {
    onResult(state);
  }, [state]);
}

function useRunner() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const run = (task: () => Promise<unknown>, success: string | ((r: unknown) => string)) =>
    startTransition(async () => {
      try {
        const result = await task();
        toast(typeof success === "function" ? success(result) : success);
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  return { pending, run };
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

function ConfirmDelete({
  open,
  title,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Excluir
          </Button>
        </>
      }
    >
      <p>{children}</p>
    </Dialog>
  );
}

export type CategoryItem = {
  id: string;
  name: string;
  nature: ExpenseNature;
  monthly_budget_cents: number | null;
};

function CategoryForm({ value, onDone }: { value?: CategoryItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveCategory, initial);
  useFormResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <Field label="Nome" error={e.name}>
        {(a) => <Input {...a} name="name" defaultValue={v("name", value?.name ?? "")} autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" error={e.nature} hint="Fixa: aluguel, contas, assinaturas">
          {(a) => (
            <Select {...a} name="nature" defaultValue={v("nature", value?.nature ?? "variable")}>
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {NATURE_LABELS[n]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Orçamento mensal (R$)"
          error={e.monthly_budget_cents}
          hint="Opcional; acima dele aparece ESTOURO"
        >
          {(a) => (
            <Input
              {...a}
              name="monthly_budget_cents"
              inputMode="decimal"
              defaultValue={v(
                "monthly_budget_cents",
                value?.monthly_budget_cents ? formatBRL(value.monthly_budget_cents) : "",
              )}
            />
          )}
        </Field>
      </div>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Criar"} />
    </form>
  );
}

function CategoryRow({ category }: { category: CategoryItem }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRunner();
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border-soft py-2",
        pending && "opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{category.name}</span>
        <span className="label">
          {NATURE_LABELS[category.nature]}
          {category.monthly_budget_cents ? ` · orçamento ${formatBRL(category.monthly_budget_cents)}` : ""}
        </span>
      </span>
      <span className="-mr-2 flex">
        <Button variant="ghost" className="min-h-9" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button variant="ghost" className="min-h-9 text-danger" onClick={() => setConfirming(true)}>
          Excluir
        </Button>
      </span>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar categoria">
        {editing ? <CategoryForm value={category} onDone={() => setEditing(false)} /> : null}
      </Dialog>
      <ConfirmDelete
        open={confirming}
        title="Excluir categoria?"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(() => deleteCategory(category.id), "Categoria excluída.");
        }}
      >
        <strong>{category.name}</strong> será excluída com suas regras. As despesas dela ficam sem categoria.
      </ConfirmDelete>
    </li>
  );
}

export function Categories({ categories }: { categories: CategoryItem[] }) {
  const [creating, setCreating] = useState(false);
  const { pending, run } = useRunner();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)}>Nova categoria</Button>
        <Button
          variant={categories.length === 0 ? "primary" : "ghost"}
          disabled={pending}
          onClick={() => run(() => seedDefaultCategories(), "Categorias e regras sugeridas criadas.")}
        >
          {categories.length === 0 ? "Criar categorias sugeridas" : "Completar sugeridas"}
        </Button>
      </div>
      {categories.length === 0 ? (
        <p className="text-muted">
          As sugeridas incluem Moradia, Mercado, Alimentação, Transporte, Saúde, Assinaturas e outras, já com
          regras para reconhecer iFood, Uber, Netflix, farmácias e mercados no extrato.
        </p>
      ) : (
        <ul className="flex flex-col">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nova categoria">
        {creating ? <CategoryForm onDone={() => setCreating(false)} /> : null}
      </Dialog>
    </div>
  );
}

export type RuleItem = { id: string; pattern: string; category: string };

export function Rules({ rules, categories }: { rules: RuleItem[]; categories: CategoryItem[] }) {
  const [state, action, pending] = useActionState(saveRule, initial);
  const toast = useToast();
  const runner = useRunner();
  const onResult = useEffectEvent((r: ActionState) => {
    if (r.status === "saved") toast(r.message);
    if (r.status === "error" && !r.fieldErrors) toast(r.message, "alert");
  });
  useEffect(() => {
    onResult(state);
  }, [state]);
  const e = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-4">
      <form
        key={state.status === "saved" ? `saved-${rules.length}` : JSON.stringify(state.values ?? {})}
        action={action}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        noValidate
      >
        <Field label="Texto na descrição" error={e.pattern} hint="Sem diferenciar maiúsculas e acentos">
          {(a) => (
            <Input {...a} name="pattern" placeholder="ifood" defaultValue={state.values?.pattern ?? ""} />
          )}
        </Field>
        <Field label="Categoria" error={e.category_id}>
          {(a) => (
            <Select {...a} name="category_id" defaultValue={state.values?.category_id ?? ""}>
              <option value="" disabled>
                Escolha
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" disabled={pending || categories.length === 0}>
          Adicionar
        </Button>
      </form>
      <Button
        variant="ghost"
        className="self-start"
        disabled={runner.pending || rules.length === 0}
        onClick={() =>
          runner.run(
            () => applyRulesToUncategorized(),
            (n) => `${n} despesas sem categoria foram categorizadas.`,
          )
        }
      >
        Aplicar às despesas sem categoria
      </Button>
      {rules.length === 0 ? (
        <p className="text-muted">
          Nenhuma regra. Elas categorizam sozinhas as linhas importadas do extrato.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-border-soft py-1"
            >
              <span className="font-mono text-data">
                “{r.pattern}” → {r.category}
              </span>
              <Button
                variant="ghost"
                className="min-h-9 text-danger"
                aria-label={`Excluir regra ${r.pattern}`}
                disabled={runner.pending}
                onClick={() => runner.run(() => deleteRule(r.id), "Regra excluída.")}
              >
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type RecurringItem = {
  id: string;
  description: string;
  amount_cents: number;
  due_day: number;
  category_id: string | null;
  category: string | null;
  context: ContextKind;
  match_pattern: string | null;
  active: boolean;
};

function RecurringForm({
  value,
  categories,
  defaultContext,
  onDone,
}: {
  value?: RecurringItem;
  categories: CategoryItem[];
  defaultContext: ContextKind;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveRecurring, initial);
  useFormResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <Field label="Descrição" error={e.description}>
        {(a) => (
          <Input
            {...a}
            name="description"
            defaultValue={v("description", value?.description ?? "")}
            autoFocus
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor previsto (R$)" error={e.amount_cents}>
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={v("amount_cents", value ? formatBRL(value.amount_cents) : "")}
            />
          )}
        </Field>
        <Field label="Dia do vencimento" error={e.due_day}>
          {(a) => (
            <Input
              {...a}
              name="due_day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={v("due_day", value?.due_day.toString() ?? "")}
            />
          )}
        </Field>
        <Field label="Categoria" error={e.category_id}>
          {(a) => (
            <Select {...a} name="category_id" defaultValue={v("category_id", value?.category_id ?? "")}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", value?.context ?? defaultContext)}>
              {CONTEXT_KINDS.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field
        label="Texto no extrato"
        error={e.match_pattern}
        hint="Ao importar, linhas com esse texto contam como esta fixa paga. Ex.: hetzner, imobiliaria lar"
      >
        {(a) => (
          <Input {...a} name="match_pattern" defaultValue={v("match_pattern", value?.match_pattern ?? "")} />
        )}
      </Field>
      <label className="flex min-h-tap items-center gap-3 font-mono text-data">
        <input
          type="checkbox"
          name="active"
          defaultChecked={state.values ? state.values.active === "on" : (value?.active ?? true)}
          className="h-5 w-5 accent-[var(--ink)]"
        />
        Ativa
      </label>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Criar"} />
    </form>
  );
}

function RecurringRow({
  item,
  categories,
  defaultContext,
}: {
  item: RecurringItem;
  categories: CategoryItem[];
  defaultContext: ContextKind;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRunner();
  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("truncate", !item.active && "text-muted")}>{item.description}</span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-data tabular-nums">
          {!item.active ? <Tag tone="outline">Inativa</Tag> : null}
          {formatBRL(item.amount_cents)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          Dia {item.due_day} · {item.category ?? "Sem categoria"} · {CONTEXT_LABELS[item.context]}
          {item.match_pattern ? ` · extrato “${item.match_pattern}”` : ""}
        </span>
        <span className="-mr-2 flex">
          <Button variant="ghost" className="min-h-9" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="ghost" className="min-h-9 text-danger" onClick={() => setConfirming(true)}>
            Excluir
          </Button>
        </span>
      </div>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar despesa fixa">
        {editing ? (
          <RecurringForm
            value={item}
            categories={categories}
            defaultContext={defaultContext}
            onDone={() => setEditing(false)}
          />
        ) : null}
      </Dialog>
      <ConfirmDelete
        open={confirming}
        title="Excluir despesa fixa?"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(() => deleteRecurring(item.id), "Despesa fixa excluída.");
        }}
      >
        <strong>{item.description}</strong> deixa de aparecer no checklist. Os pagamentos já lançados ficam.
      </ConfirmDelete>
    </li>
  );
}

export function RecurringList({
  items,
  categories,
  defaultContext,
}: {
  items: RecurringItem[];
  categories: CategoryItem[];
  defaultContext: ContextKind;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button className="self-start" onClick={() => setCreating(true)}>
        Nova despesa fixa
      </Button>
      {items.length === 0 ? (
        <p className="text-muted">
          Aluguel, condomínio, internet, assinaturas, VPS: o que se repete todo mês.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((i) => (
            <RecurringRow key={i.id} item={i} categories={categories} defaultContext={defaultContext} />
          ))}
        </ul>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nova despesa fixa">
        {creating ? (
          <RecurringForm
            categories={categories}
            defaultContext={defaultContext}
            onDone={() => setCreating(false)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

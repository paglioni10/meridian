"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Money, Tag } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteExpense, markRecurringPaid, saveExpense, type ActionState } from "@/features/expenses/actions";
import {
  CONTEXT_KINDS,
  NATURES,
  NATURE_LABELS,
  type ContextKind,
  type ExpenseNature,
} from "@/features/expenses/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type CategoryOption = { id: string; name: string; nature: ExpenseNature };

export type ProjectOption = { id: string; name: string };

const ProjectsContext = createContext<ProjectOption[]>([]);

export function ExpenseProjectsProvider({
  projects,
  children,
}: {
  projects: ProjectOption[];
  children: ReactNode;
}) {
  return <ProjectsContext value={projects}>{children}</ProjectsContext>;
}

export type ExpenseValues = {
  id?: string;
  description: string;
  amount: string;
  occurred_on: string;
  category_id: string;
  nature: ExpenseNature;
  context: ContextKind;
  recurring_expense_id: string;
  project_id: string;
};

function ExpenseForm({
  values,
  categories,
  onDone,
}: {
  values: ExpenseValues;
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveExpense, {
    status: "idle",
    message: "",
  });
  const toast = useToast();
  const e = state.fieldErrors ?? {};
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const [nature, setNature] = useState<string>(v("nature", values.nature));
  const projects = useContext(ProjectsContext);

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

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />
      <input type="hidden" name="recurring_expense_id" value={values.recurring_expense_id} />
      <Field label="Descrição" error={e.description}>
        {(a) => (
          <Input {...a} name="description" defaultValue={v("description", values.description)} autoFocus />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)" error={e.amount_cents}>
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={v("amount_cents", values.amount)}
              placeholder="89,90"
            />
          )}
        </Field>
        <Field label="Data" error={e.occurred_on}>
          {(a) => (
            <Input
              {...a}
              name="occurred_on"
              type="date"
              defaultValue={v("occurred_on", values.occurred_on)}
            />
          )}
        </Field>
        <Field label="Categoria" error={e.category_id}>
          {(a) => (
            <Select
              {...a}
              name="category_id"
              defaultValue={v("category_id", values.category_id)}
              onChange={(ev) => {
                const cat = categories.find((c) => c.id === ev.target.value);
                if (cat && !values.recurring_expense_id) setNature(cat.nature);
              }}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tipo" error={e.nature}>
          {(a) => (
            <Select {...a} name="nature" value={nature} onChange={(ev) => setNature(ev.target.value)}>
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {NATURE_LABELS[n]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {projects.length > 0 ? (
          <Field label="Projeto" error={e.project_id} hint="Liga a despesa à margem do cliente">
            {(a) => (
              <Select {...a} name="project_id" defaultValue={v("project_id", values.project_id)}>
                <option value="">Sem projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <input type="hidden" name="project_id" value={values.project_id} />
        )}
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", values.context)}>
              {CONTEXT_KINDS.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : values.id ? "Salvar" : "Lançar"}
        </Button>
      </div>
    </form>
  );
}

export function ExpenseDialog({
  open,
  onClose,
  values,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  values: ExpenseValues;
  categories: CategoryOption[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar despesa" : "Nova despesa"}>
      {open ? <ExpenseForm values={values} categories={categories} onDone={onClose} /> : null}
    </Dialog>
  );
}

export function NewExpenseButton({
  categories,
  today,
  defaultContext,
}: {
  categories: CategoryOption[];
  today: string;
  defaultContext: ContextKind;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nova despesa
      </Button>
      <ExpenseDialog
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        values={{
          description: "",
          amount: "",
          occurred_on: today,
          category_id: "",
          nature: "variable",
          context: defaultContext,
          recurring_expense_id: "",
          project_id: "",
        }}
      />
    </>
  );
}

function useRunner() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const run = (task: () => Promise<void>, success: string) =>
    startTransition(async () => {
      try {
        await task();
        toast(success);
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  return { pending, run };
}

export type ExpenseItem = {
  id: string;
  description: string;
  amount_cents: number;
  occurred_on: string;
  category_id: string | null;
  category: string | null;
  nature: ExpenseNature;
  context: ContextKind;
  source: string;
  recurring_expense_id: string | null;
  project_id: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  import: "Importada",
  recurring: "Fixa paga",
  capture: "Captura",
};

function ExpenseRowItem({
  expense,
  categories,
  showContext,
}: {
  expense: ExpenseItem;
  categories: CategoryOption[];
  showContext: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRunner();
  const meta = [
    expense.category ?? "Sem categoria",
    NATURE_LABELS[expense.nature],
    SOURCE_LABELS[expense.source],
    showContext ? CONTEXT_LABELS[expense.context] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3 font-mono text-data">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="w-11 shrink-0 text-muted tabular-nums">{formatDayMonth(expense.occurred_on)}</span>
          <span className="truncate">{expense.description}</span>
        </span>
        <Money cents={-expense.amount_cents} className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-14">
        <span className={cn("label", !expense.category && "text-danger")}>{meta}</span>
        <span className="-mr-2 flex">
          <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            className="min-h-9 text-danger"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Excluir
          </Button>
        </span>
      </div>
      <ExpenseDialog
        open={editing}
        onClose={() => setEditing(false)}
        categories={categories}
        values={{
          id: expense.id,
          description: expense.description,
          amount: formatBRL(expense.amount_cents),
          occurred_on: expense.occurred_on,
          category_id: expense.category_id ?? "",
          nature: expense.nature,
          context: expense.context,
          recurring_expense_id: expense.recurring_expense_id ?? "",
          project_id: expense.project_id ?? "",
        }}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Excluir despesa?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                run(() => deleteExpense(expense.id), "Despesa excluída.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          {expense.description} · {formatBRL(expense.amount_cents)} será excluída.
          {expense.source === "import"
            ? " Se o extrato for importado de novo, ela não volta, porque o arquivo já foi registrado."
            : ""}
        </p>
      </Dialog>
    </li>
  );
}

export function ExpenseList({
  expenses,
  categories,
  showContext,
}: {
  expenses: ExpenseItem[];
  categories: CategoryOption[];
  showContext: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {expenses.map((e) => (
        <ExpenseRowItem key={e.id} expense={e} categories={categories} showContext={showContext} />
      ))}
    </ul>
  );
}

export type FixedItem = {
  id: string;
  description: string;
  amount_cents: number;
  due_day: number;
  status: "paid" | "pending" | "late";
  paid_cents: number;
};

function FixedRow({ item, month }: { item: FixedItem; month: string }) {
  const { pending, run } = useRunner();
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border-soft py-2",
        pending && "opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className={cn("truncate", item.status === "paid" && "text-muted")}>{item.description}</span>
        <span className="label">
          Dia {item.due_day} · {formatBRL(item.status === "paid" ? item.paid_cents : item.amount_cents)}
        </span>
      </span>
      {item.status === "paid" ? (
        <Tag tone="ink">Paga</Tag>
      ) : (
        <span className="flex items-center gap-2">
          {item.status === "late" ? <Tag>Atrasada</Tag> : <Tag tone="outline">Pendente</Tag>}
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => markRecurringPaid(item.id, month), `${item.description}: paga.`)}
          >
            Marcar paga
          </Button>
        </span>
      )}
    </li>
  );
}

export function FixedChecklist({ items, month }: { items: FixedItem[]; month: string }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <FixedRow key={item.id} item={item} month={month} />
      ))}
    </ul>
  );
}

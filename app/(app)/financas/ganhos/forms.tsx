"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  saveIncome,
  saveSource,
  type IncomeFormState,
  type SourceFormState,
} from "@/features/income/actions";
import {
  CONTEXT_KINDS,
  INCOME_KINDS,
  KIND_HINTS,
  KIND_LABELS,
  type ContextKind,
  type IncomeKind,
} from "@/features/income/schema";
import { CONTEXT_LABELS } from "@/lib/context";

export type SourceOption = { id: string; name: string; kind: IncomeKind; active: boolean };

export type SourceValues = {
  id?: string;
  name: string;
  kind: IncomeKind;
  context: ContextKind;
  default_amount: string;
  payday: string;
  active: boolean;
};

export type IncomeValues = {
  id?: string;
  source_id: string;
  competence_month: string;
  received_on: string;
  amount: string;
  gross: string;
  description: string;
};

function useResult<S extends { status: string; message: string; fieldErrors?: object }>(
  state: S,
  onDone: () => void,
) {
  const toast = useToast();
  const onResult = useEffectEvent((result: S) => {
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

function SourceForm({ values, onDone }: { values: SourceValues; onDone: () => void }) {
  const [state, action, pending] = useActionState<SourceFormState, FormData>(saveSource, {
    status: "idle",
    message: "",
  });
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />
      <Field label="Nome" error={e.name}>
        {(a) => (
          <Input
            {...a}
            name="name"
            defaultValue={v("name", values.name)}
            placeholder="Empresa X (CLT)"
            autoFocus
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de renda" error={e.kind} hint={KIND_HINTS[values.kind]}>
          {(a) => (
            <Select {...a} name="kind" defaultValue={v("kind", values.kind)}>
              {INCOME_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]} · {KIND_HINTS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
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
        <Field
          label="Valor líquido padrão (R$)"
          error={e.default_amount_cents}
          hint="Usado no botão Lançar mês"
        >
          {(a) => (
            <Input
              {...a}
              name="default_amount_cents"
              inputMode="decimal"
              defaultValue={v("default_amount_cents", values.default_amount)}
              placeholder="5.200,00"
            />
          )}
        </Field>
        <Field label="Dia do pagamento" error={e.payday}>
          {(a) => (
            <Input
              {...a}
              name="payday"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={v("payday", values.payday)}
              placeholder="5"
            />
          )}
        </Field>
      </div>
      <label className="flex min-h-tap items-center gap-3 font-mono text-data">
        <input
          type="checkbox"
          name="active"
          defaultChecked={state.values ? state.values.active === "on" : values.active}
          className="h-5 w-5 accent-[var(--ink)]"
        />
        Fonte ativa
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : values.id ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}

function IncomeForm({
  values,
  sources,
  onDone,
}: {
  values: IncomeValues;
  sources: SourceOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<IncomeFormState, FormData>(saveIncome, {
    status: "idle",
    message: "",
  });
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const options = sources.filter((s) => s.active || s.id === values.source_id);

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />
      <Field label="Fonte" error={e.source_id}>
        {(a) => (
          <Select {...a} name="source_id" defaultValue={v("source_id", values.source_id)} autoFocus>
            <option value="" disabled>
              Escolha a fonte
            </option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {KIND_LABELS[s.kind]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor líquido (R$)" error={e.amount_cents}>
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={v("amount_cents", values.amount)}
              placeholder="1.800,00"
            />
          )}
        </Field>
        <Field label="Valor bruto (R$)" error={e.gross_cents} hint="Opcional">
          {(a) => (
            <Input
              {...a}
              name="gross_cents"
              inputMode="decimal"
              defaultValue={v("gross_cents", values.gross)}
            />
          )}
        </Field>
        <Field label="Mês de competência" error={e.competence_month} hint="Mês a que o ganho se refere">
          {(a) => (
            <Input
              {...a}
              name="competence_month"
              type="month"
              defaultValue={v("competence_month", values.competence_month)}
            />
          )}
        </Field>
        <Field label="Recebido em" error={e.received_on}>
          {(a) => (
            <Input
              {...a}
              name="received_on"
              type="date"
              defaultValue={v("received_on", values.received_on)}
            />
          )}
        </Field>
      </div>
      <Field label="Descrição" error={e.description} hint="Opcional, ex.: 13º, bônus, projeto">
        {(a) => <Input {...a} name="description" defaultValue={v("description", values.description)} />}
      </Field>
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

export function SourceDialog({
  open,
  onClose,
  values,
}: {
  open: boolean;
  onClose: () => void;
  values: SourceValues;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar fonte" : "Nova fonte de renda"}>
      {open ? <SourceForm values={values} onDone={onClose} /> : null}
    </Dialog>
  );
}

export function IncomeDialog({
  open,
  onClose,
  values,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  values: IncomeValues;
  sources: SourceOption[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar ganho" : "Novo ganho"}>
      {open ? <IncomeForm values={values} sources={sources} onDone={onClose} /> : null}
    </Dialog>
  );
}

export function NewSourceButton({
  defaultContext,
  primary,
}: {
  defaultContext: ContextKind;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={primary ? "primary" : "default"} onClick={() => setOpen(true)}>
        Nova fonte
      </Button>
      <SourceDialog
        open={open}
        onClose={() => setOpen(false)}
        values={{
          name: "",
          kind: "guaranteed",
          context: defaultContext,
          default_amount: "",
          payday: "",
          active: true,
        }}
      />
    </>
  );
}

export function NewIncomeButton({
  sources,
  month,
  today,
}: {
  sources: SourceOption[];
  month: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const active = sources.filter((s) => s.active);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={active.length === 0}>
        Novo ganho
      </Button>
      <IncomeDialog
        open={open}
        onClose={() => setOpen(false)}
        sources={sources}
        values={{
          source_id: active.length === 1 ? active[0].id : "",
          competence_month: month.slice(0, 7),
          received_on: today,
          amount: "",
          gross: "",
          description: "",
        }}
      />
    </>
  );
}

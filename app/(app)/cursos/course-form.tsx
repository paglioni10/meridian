"use client";

import { useActionState, useEffect, useEffectEvent, useId, useState, type FocusEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveCourse, type CourseFormState } from "@/features/courses/actions";
import {
  CONTEXT_KINDS,
  COURSE_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ContextKind,
  type CourseStatus,
  type Priority,
} from "@/features/courses/schema";
import { CONTEXT_LABELS } from "@/lib/context";
import { isObsidianLink, noteFromObsidianLink } from "@/lib/obsidian";

export type CourseFormValues = {
  id?: string;
  title: string;
  url: string | null;
  provider: string | null;
  category: string | null;
  context: ContextKind;
  priority: Priority;
  status: CourseStatus;
  estimated_hours: number | null;
  progress_pct: number;
  obsidian_note: string | null;
};

const initial: CourseFormState = { status: "idle", message: "" };

function CourseForm({
  values,
  categories,
  onDone,
}: {
  values: CourseFormValues;
  categories: string[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveCourse, initial);
  const toast = useToast();
  const listId = useId();
  const e = state.fieldErrors ?? {};
  const sent = state.values;
  const v = (name: string, fallback: string) => sent?.[name] ?? fallback;
  const editing = Boolean(values.id);
  const [moved, setMoved] = useState<string | null>(null);

  function moveObsidianLink(input: HTMLInputElement, text: string) {
    if (!isObsidianLink(text)) return false;
    const note = noteFromObsidianLink(text);
    if (!note) return false;
    const noteField = input.form?.elements.namedItem("obsidian_note");
    if (noteField instanceof HTMLInputElement) noteField.value = note;
    input.value = "";
    setMoved(note);
    return true;
  }

  function checkUrlField(event: FocusEvent<HTMLInputElement>) {
    moveObsidianLink(event.currentTarget, event.currentTarget.value);
  }

  function checkNoteField(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (!isObsidianLink(input.value)) return;
    const note = noteFromObsidianLink(input.value);
    if (note) input.value = note;
  }

  const onResult = useEffectEvent((result: CourseFormState) => {
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
      {!editing ? <input type="hidden" name="status" value="backlog" /> : null}
      {!editing ? <input type="hidden" name="progress_pct" value="0" /> : null}

      <Field label="Título" error={e.title}>
        {(a) => <Input {...a} name="title" defaultValue={v("title", values.title)} required autoFocus />}
      </Field>
      <Field
        label="Link do curso (site)"
        error={e.url}
        hint={
          moved
            ? `Link do Obsidian movido para “Nota no Obsidian”: ${moved}`
            : "Endereço do curso na Udemy, YouTube etc. · pode ficar vazio"
        }
      >
        {(a) => (
          <Input
            {...a}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={v("url", values.url ?? "")}
            placeholder="https://"
            onBlur={checkUrlField}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (moveObsidianLink(event.currentTarget, text)) event.preventDefault();
            }}
            onInput={() => setMoved(null)}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plataforma" error={e.provider}>
          {(a) => (
            <Input
              {...a}
              name="provider"
              defaultValue={v("provider", values.provider ?? "")}
              placeholder="Udemy, Alura…"
            />
          )}
        </Field>
        <Field label="Categoria" error={e.category} hint="Digite uma nova ou escolha">
          {(a) => (
            <>
              <Input
                {...a}
                name="category"
                list={listId}
                defaultValue={v("category", values.category ?? "")}
              />
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Prioridade" error={e.priority}>
          {(a) => (
            <Select {...a} name="priority" defaultValue={v("priority", values.priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Horas estimadas" error={e.estimated_hours}>
          {(a) => (
            <Input
              {...a}
              name="estimated_hours"
              inputMode="decimal"
              defaultValue={v("estimated_hours", values.estimated_hours?.toString().replace(".", ",") ?? "")}
              placeholder="12"
            />
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
        {editing ? (
          <Field label="Status" error={e.status}>
            {(a) => (
              <Select {...a} name="status" defaultValue={v("status", values.status)}>
                {COURSE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        {editing ? (
          <Field label="Progresso (%)" error={e.progress_pct}>
            {(a) => (
              <Input
                {...a}
                name="progress_pct"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={v("progress_pct", String(values.progress_pct))}
              />
            )}
          </Field>
        ) : null}
      </div>
      <Field
        label="Nota no Obsidian"
        error={e.obsidian_note}
        hint="Caminho da nota no vault, sem .md (ex.: Cursos/Docker avançado) · ou cole o link obsidian://"
      >
        {(a) => (
          <Input
            {...a}
            name="obsidian_note"
            defaultValue={v("obsidian_note", values.obsidian_note ?? "")}
            placeholder="Cursos/Docker avançado"
            onBlur={checkNoteField}
          />
        )}
      </Field>

      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : editing ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}

export function CourseDialog({
  open,
  onClose,
  values,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  values: CourseFormValues;
  categories: string[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar curso" : "Novo curso"}>
      {open ? <CourseForm values={values} categories={categories} onDone={onClose} /> : null}
    </Dialog>
  );
}

export function NewCourseButton({
  categories,
  defaultContext,
}: {
  categories: string[];
  defaultContext: ContextKind;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Novo curso
      </Button>
      <CourseDialog
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        values={{
          title: "",
          url: null,
          provider: null,
          category: null,
          context: defaultContext,
          priority: "medium",
          status: "backlog",
          estimated_hours: null,
          progress_pct: 0,
          obsidian_note: null,
        }}
      />
    </>
  );
}

"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteTask, saveProject, saveTask, type ActionState } from "@/features/projects/actions";
import {
  CONTEXT_KINDS,
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ContextKind,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
} from "@/features/projects/schema";
import { CONTEXT_LABELS } from "@/lib/context";

const initial: ActionState = { status: "idle", message: "" };

export type ProjectOption = { id: string; name: string; context: ContextKind };

export type TaskValues = {
  id?: string;
  title: string;
  description: string;
  project_id: string;
  context: ContextKind;
  priority: Priority;
  status: TaskStatus;
  due_on: string;
};

export type ProjectValues = {
  id?: string;
  name: string;
  description: string;
  context: ContextKind;
  status: ProjectStatus;
  due_on: string;
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

function TaskForm({
  values,
  projects,
  onDone,
}: {
  values: TaskValues;
  projects: ProjectOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveTask, initial);
  const [deleting, startDelete] = useTransition();
  const toast = useToast();
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [projectId, setProjectId] = useState(v("project_id", values.project_id));
  const project = projects.find((p) => p.id === projectId);

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />
      <Field label="Tarefa" error={e.title}>
        {(a) => <Input {...a} name="title" defaultValue={v("title", values.title)} autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Projeto" error={e.project_id}>
          {(a) => (
            <Select
              {...a}
              name="project_id"
              value={projectId}
              onChange={(ev) => setProjectId(ev.target.value)}
            >
              <option value="">Sem projeto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Contexto" error={e.context} hint={project ? "Segue o contexto do projeto" : undefined}>
          {(a) =>
            project ? (
              <>
                <input type="hidden" name="context" value={project.context} />
                <Input {...a} value={CONTEXT_LABELS[project.context]} disabled readOnly />
              </>
            ) : (
              <Select {...a} name="context" defaultValue={v("context", values.context)}>
                {CONTEXT_KINDS.map((c) => (
                  <option key={c} value={c}>
                    {CONTEXT_LABELS[c]}
                  </option>
                ))}
              </Select>
            )
          }
        </Field>
        <Field label="Status" error={e.status}>
          {(a) => (
            <Select {...a} name="status" defaultValue={v("status", values.status)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
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
        <Field label="Prazo" error={e.due_on}>
          {(a) => <Input {...a} name="due_on" type="date" defaultValue={v("due_on", values.due_on)} />}
        </Field>
      </div>
      <Field label="Descrição" error={e.description}>
        {(a) => <Textarea {...a} name="description" defaultValue={v("description", values.description)} />}
      </Field>
      <div className="modal-actions">
        {values.id ? (
          <Button
            variant="ghost"
            className="text-danger sm:mr-auto"
            disabled={deleting || pending}
            onClick={() =>
              startDelete(async () => {
                try {
                  await deleteTask(values.id!);
                  toast("Tarefa excluída.");
                  onDone();
                } catch (err) {
                  toast((err as Error).message, "alert");
                }
              })
            }
          >
            Excluir
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : values.id ? "Salvar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}

export function TaskDialog({
  open,
  onClose,
  values,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  values: TaskValues;
  projects: ProjectOption[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar tarefa" : "Nova tarefa"}>
      {open ? <TaskForm values={values} projects={projects} onDone={onClose} /> : null}
    </Dialog>
  );
}

function ProjectForm({ values, onDone }: { values: ProjectValues; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveProject, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={values.id ?? ""} />
      <Field label="Nome" error={e.name}>
        {(a) => <Input {...a} name="name" defaultValue={v("name", values.name)} autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contexto" error={e.context} hint="As tarefas do projeto seguem este contexto">
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
        <Field label="Status" error={e.status}>
          {(a) => (
            <Select {...a} name="status" defaultValue={v("status", values.status)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Prazo" error={e.due_on}>
          {(a) => <Input {...a} name="due_on" type="date" defaultValue={v("due_on", values.due_on)} />}
        </Field>
      </div>
      <Field label="Descrição" error={e.description}>
        {(a) => <Input {...a} name="description" defaultValue={v("description", values.description)} />}
      </Field>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : values.id ? "Salvar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectDialog({
  open,
  onClose,
  values,
}: {
  open: boolean;
  onClose: () => void;
  values: ProjectValues;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={values.id ? "Editar projeto" : "Novo projeto"}>
      {open ? <ProjectForm values={values} onDone={onClose} /> : null}
    </Dialog>
  );
}

export function NewProjectButton({ defaultContext }: { defaultContext: ContextKind }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Novo projeto</Button>
      <ProjectDialog
        open={open}
        onClose={() => setOpen(false)}
        values={{ name: "", description: "", context: defaultContext, status: "active", due_on: "" }}
      />
    </>
  );
}

export function NewTaskButton({
  projects,
  defaultContext,
  defaultProject,
}: {
  projects: ProjectOption[];
  defaultContext: ContextKind;
  defaultProject: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nova tarefa
      </Button>
      <TaskDialog
        open={open}
        onClose={() => setOpen(false)}
        projects={projects}
        values={{
          title: "",
          description: "",
          project_id: defaultProject,
          context: defaultContext,
          priority: "medium",
          status: "todo",
          due_on: "",
        }}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/display";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { archiveDoneTasks, deleteProject } from "@/features/projects/actions";
import { PROJECT_STATUS_LABELS, type ContextKind, type ProjectStatus } from "@/features/projects/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDayMonth } from "@/lib/dates";
import { ProjectDialog } from "./task-forms";

export function ProjectFilter({
  projects,
  value,
}: {
  projects: Array<{ id: string; name: string }>;
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (
    <label className="field max-w-xs">
      <span className="field-label">Projeto</span>
      <Select
        value={value}
        onChange={(e) =>
          startTransition(() =>
            router.replace(e.target.value ? `${pathname}?projeto=${e.target.value}` : pathname, {
              scroll: false,
            }),
          )
        }
      >
        <option value="">Todos os projetos</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ArchiveDoneButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      disabled={pending || count === 0}
      onClick={() =>
        startTransition(async () => {
          try {
            const n = await archiveDoneTasks();
            toast(`${n} ${n === 1 ? "tarefa entregue arquivada" : "tarefas entregues arquivadas"}.`);
          } catch (e) {
            toast((e as Error).message, "alert");
          }
        })
      }
    >
      Arquivar entregues ({count})
    </Button>
  );
}

export type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  context: ContextKind;
  status: ProjectStatus;
  due_on: string | null;
  client: string | null;
  openTasks: number;
  doneTasks: number;
};

function ProjectRow({
  project,
  today,
  showContext,
}: {
  project: ProjectItem;
  today: string;
  showContext: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const late = project.status === "active" && project.due_on !== null && project.due_on < today;
  const total = project.openTasks + project.doneTasks;

  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/projetos?projeto=${project.id}`}
          className="truncate text-foreground hover:text-danger"
          scroll={false}
        >
          {project.name}
        </Link>
        <span className="flex shrink-0 items-center gap-2">
          {late ? <Tag>Atrasado</Tag> : null}
          {project.status !== "active" ? (
            <Tag tone="outline">{PROJECT_STATUS_LABELS[project.status]}</Tag>
          ) : null}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          {[
            project.client ? `Cliente ${project.client}` : null,
            showContext ? CONTEXT_LABELS[project.context] : null,
            total ? `${project.doneTasks} de ${total} entregues` : "Sem tarefas",
            project.due_on ? `Prazo ${formatDayMonth(project.due_on)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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
      <ProjectDialog
        open={editing}
        onClose={() => setEditing(false)}
        values={{
          id: project.id,
          name: project.name,
          description: project.description ?? "",
          context: project.context,
          status: project.status,
          due_on: project.due_on ?? "",
        }}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Excluir projeto?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                startTransition(async () => {
                  try {
                    await deleteProject(project.id);
                    toast("Projeto excluído.");
                  } catch (e) {
                    toast((e as Error).message, "alert");
                  }
                });
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{project.name}</strong> e suas {total} tarefas serão excluídos. Despesas ligadas a ele ficam
          sem projeto. Para guardar o histórico, prefira marcar como concluído.
        </p>
      </Dialog>
    </li>
  );
}

export function ProjectList({
  projects,
  today,
  showContext,
}: {
  projects: ProjectItem[];
  today: string;
  showContext: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} today={today} showContext={showContext} />
      ))}
    </ul>
  );
}

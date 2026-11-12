"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress, Tag } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import { deleteCourse, setCourseStatus } from "@/features/courses/actions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ContextKind,
  type CourseStatus,
  type Priority,
} from "@/features/courses/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatHours } from "@/lib/hours";
import { normalizeNotePath, obsidianUri } from "@/lib/obsidian";
import { CourseDialog } from "./course-form";

export type CourseItem = {
  id: string;
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

const NEXT_ACTIONS: Record<CourseStatus, Array<{ to: CourseStatus; label: string }>> = {
  backlog: [{ to: "in_progress", label: "Começar" }],
  in_progress: [
    { to: "done", label: "Concluir" },
    { to: "paused", label: "Pausar" },
  ],
  paused: [{ to: "in_progress", label: "Retomar" }],
  done: [{ to: "in_progress", label: "Reabrir" }],
  dropped: [{ to: "backlog", label: "Voltar ao backlog" }],
};

function PriorityTag({ priority }: { priority: Priority }) {
  const tone = priority === "critical" ? "alert" : priority === "high" ? "ink" : "outline";
  return <Tag tone={tone}>{PRIORITY_LABELS[priority]}</Tag>;
}

function ObsidianLink({ vault, note }: { vault: string | null; note: string | null }) {
  if (!note) return <span className="label">Sem nota</span>;
  if (!vault) {
    return (
      <Link href="/ajustes" className="label hover:text-danger">
        Defina o vault em Ajustes
      </Link>
    );
  }
  return (
    <a href={obsidianUri(vault, note)} className="min-w-0 truncate font-mono text-data">
      obsidian://{normalizeNotePath(note)} →
    </a>
  );
}

function CourseRowItem({
  course,
  vault,
  categories,
  showContext,
}: {
  course: CourseItem;
  vault: string | null;
  categories: string[];
  showContext: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function run(task: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await task();
        toast(success);
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  }

  const meta = [course.provider, course.category, showContext ? CONTEXT_LABELS[course.context] : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("flex flex-col gap-2 border-b border-border-soft py-3", pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {course.url ? (
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-danger"
            >
              {course.title}
            </a>
          ) : (
            <span className="font-medium">{course.title}</span>
          )}
          <span className="label">
            {STATUS_LABELS[course.status]}
            {meta ? ` · ${meta}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-data tabular-nums">{formatHours(course.estimated_hours)}</span>
          <PriorityTag priority={course.priority} />
        </div>
      </div>

      {course.status === "in_progress" ? (
        <div className="flex items-center gap-3">
          <Progress value={course.progress_pct} tone="active" label={`Progresso de ${course.title}`} />
          <span className="font-mono text-label tabular-nums">{course.progress_pct}%</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ObsidianLink vault={vault} note={course.obsidian_note} />
        <div className="-mr-2 flex flex-wrap items-center">
          {NEXT_ACTIONS[course.status].map((a) => (
            <Button
              key={a.to}
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(() => setCourseStatus(course.id, a.to), `${course.title}: ${STATUS_LABELS[a.to]}`)
              }
            >
              {a.label}
            </Button>
          ))}
          <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            className="text-danger"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Excluir
          </Button>
        </div>
      </div>

      <CourseDialog
        open={editing}
        onClose={() => setEditing(false)}
        categories={categories}
        values={course}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Excluir curso?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                run(() => deleteCourse(course.id), "Curso excluído.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{course.title}</strong> será removido do backlog. Esta ação não pode ser desfeita.
        </p>
      </Dialog>
    </li>
  );
}

export function CourseList({
  courses,
  vault,
  categories,
  showContext,
}: {
  courses: CourseItem[];
  vault: string | null;
  categories: string[];
  showContext: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {courses.map((course) => (
        <CourseRowItem
          key={course.id}
          course={course}
          vault={vault}
          categories={categories}
          showContext={showContext}
        />
      ))}
    </ul>
  );
}

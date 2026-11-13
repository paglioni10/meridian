"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { Tag } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import { moveTask, quickAddTask } from "@/features/projects/actions";
import {
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ContextKind,
  type Priority,
  type TaskStatus,
} from "@/features/projects/schema";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/dates";
import { TaskDialog, type ProjectOption } from "./task-forms";

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_on: string | null;
  context: ContextKind;
  project_id: string | null;
  project: string | null;
};

type Columns = Record<TaskStatus, BoardTask[]>;

function group(tasks: BoardTask[]): Columns {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

function findColumn(columns: Columns, id: string): TaskStatus | null {
  if ((TASK_STATUSES as readonly string[]).includes(id)) return id as TaskStatus;
  return TASK_STATUSES.find((s) => columns[s].some((t) => t.id === id)) ?? null;
}

function TaskCardView({ task, today, dragging }: { task: BoardTask; today: string; dragging?: boolean }) {
  const late = task.status !== "done" && task.due_on !== null && task.due_on < today;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-t bg-background pt-2 pb-3",
        task.status === "doing" ? "border-secondary" : late ? "border-danger" : "border-border",
        task.status === "done" && "text-muted",
        dragging && "border-x border-b border-x-border border-b-border px-2 shadow-modal",
      )}
    >
      <span className={cn("text-body font-medium", task.status === "done" && "line-through")}>
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {task.project ? <span className="label">{task.project}</span> : null}
        {task.due_on ? (
          <span className={cn("font-mono text-label tabular-nums", late ? "text-danger" : "text-muted")}>
            {formatDayMonth(task.due_on)}
          </span>
        ) : null}
        {late ? <Tag>Atrasada</Tag> : null}
        {task.priority === "critical" ? <Tag>{PRIORITY_LABELS.critical}</Tag> : null}
        {task.priority === "high" ? <Tag tone="ink">{PRIORITY_LABELS.high}</Tag> : null}
      </span>
    </div>
  );
}

function SortableTask({
  task,
  today,
  onOpen,
}: {
  task: BoardTask;
  today: string;
  onOpen: (t: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-roledescription="tarefa arrastável"
        aria-label={`${task.title}. ${TASK_STATUS_LABELS[task.status]}. Enter abre, espaço arrasta.`}
        onClick={() => onOpen(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onOpen(task);
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
        className="block w-full cursor-grab text-left active:cursor-grabbing"
      >
        <TaskCardView task={task} today={today} />
      </button>
    </li>
  );
}

function Column({
  status,
  tasks,
  today,
  onOpen,
  onQuickAdd,
  adding,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  today: string;
  onOpen: (t: BoardTask) => void;
  onQuickAdd: (status: TaskStatus, title: string) => void;
  adding: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [title, setTitle] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    onQuickAdd(status, title.trim());
    setTitle("");
  }

  return (
    <section aria-labelledby={`col-${status}`} className="flex min-w-0 snap-start flex-col gap-3">
      <div className="flex items-baseline justify-between border-b border-border pb-1.5">
        <h2 id={`col-${status}`} className="font-mono text-label uppercase">
          {TASK_STATUS_LABELS[status]}
        </h2>
        <span className="font-mono text-label text-muted tabular-nums">{tasks.length}</span>
      </div>
      <SortableContext id={status} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn("flex min-h-24 flex-col gap-2 transition-colors", isOver && "bg-border-soft/40")}
        >
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} today={today} onOpen={onOpen} />
          ))}
        </ul>
      </SortableContext>
      <form onSubmit={submit} className="flex items-end gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={`Nova tarefa em ${TASK_STATUS_LABELS[status]}`}
          placeholder="+ Adicionar tarefa"
          maxLength={160}
          disabled={adding}
          className="input"
        />
      </form>
    </section>
  );
}

export function Board({
  tasks,
  projects,
  today,
  defaultContext,
  projectFilter,
}: {
  tasks: BoardTask[];
  projects: ProjectOption[];
  today: string;
  defaultContext: ContextKind;
  projectFilter: string | null;
}) {
  const dndId = useId();
  const serverColumns = useMemo(() => group(tasks), [tasks]);
  const [columns, setColumns] = useState<Columns>(serverColumns);
  const [synced, setSynced] = useState(serverColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [startColumns, setStartColumns] = useState<Columns | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startMove] = useTransition();
  const toast = useToast();

  if (synced !== serverColumns) {
    setSynced(serverColumns);
    setColumns(serverColumns);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) =>
    TASK_STATUSES.flatMap((s) => columns[s]).find((t) => t.id === String(id))?.title ?? "tarefa";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tarefa ${titleOf(active.id)} pega.`,
    onDragOver: ({ active, over }) => {
      if (!over) return `${titleOf(active.id)} fora das colunas.`;
      const col = findColumn(columns, String(over.id));
      return col ? `${titleOf(active.id)} sobre ${TASK_STATUS_LABELS[col]}.` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const col = over ? findColumn(columns, String(over.id)) : null;
      return col
        ? `${titleOf(active.id)} solta em ${TASK_STATUS_LABELS[col]}.`
        : `${titleOf(active.id)} solta.`;
    },
    onDragCancel: ({ active }) => `Movimento de ${titleOf(active.id)} cancelado.`,
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setStartColumns(columns);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findColumn(columns, String(active.id));
    const to = findColumn(columns, String(over.id));
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const moving = current[from].find((t) => t.id === active.id);
      if (!moving) return current;
      const target = current[to];
      const overIndex = target.findIndex((t) => t.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: current[from].filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, status: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    const before = startColumns;
    setStartColumns(null);
    if (!over || !before) {
      if (before) setColumns(before);
      return;
    }
    const to = findColumn(columns, String(over.id));
    if (!to) return;

    let list = columns[to];
    const oldIndex = list.findIndex((t) => t.id === active.id);
    const overIndex = list.findIndex((t) => t.id === over.id);
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      list = arrayMove(list, oldIndex, overIndex);
      setColumns((current) => ({ ...current, [to]: list }));
    }

    const index = list.findIndex((t) => t.id === active.id);
    const originalColumn = findColumn(before, String(active.id));
    const originalIndex = originalColumn ? before[originalColumn].findIndex((t) => t.id === active.id) : -1;
    if (originalColumn === to && originalIndex === index) return;

    const beforeId = index > 0 ? list[index - 1].id : null;
    const afterId = index < list.length - 1 ? list[index + 1].id : null;
    startMove(async () => {
      try {
        await moveTask(String(active.id), to, beforeId, afterId);
      } catch (e) {
        setColumns(before);
        toast((e as Error).message, "alert");
      }
    });
  }

  function quickAdd(status: TaskStatus, title: string) {
    const project = projects.find((p) => p.id === projectFilter);
    startAdd(async () => {
      try {
        await quickAddTask({
          title,
          status,
          projectId: project?.id ?? null,
          context: project?.context ?? defaultContext,
        });
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  }

  const active = activeId ? TASK_STATUSES.flatMap((s) => columns[s]).find((t) => t.id === activeId) : null;

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          if (startColumns) setColumns(startColumns);
          setActiveId(null);
          setStartColumns(null);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para mover uma tarefa, pressione espaço, use as setas para escolher a posição e espaço de novo para soltar. Esc cancela.",
          },
        }}
      >
        <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] auto-cols-[85%] grid-flow-col gap-6 overflow-x-auto px-4 pb-2 sm:auto-cols-[60%] md:mx-0 md:scroll-px-0 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:px-0">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              today={today}
              onOpen={setEditing}
              onQuickAdd={quickAdd}
              adding={adding}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <TaskCardView task={active} today={today} dragging /> : null}
        </DragOverlay>
      </DndContext>
      <TaskDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        projects={projects}
        values={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                description: editing.description ?? "",
                project_id: editing.project_id ?? "",
                context: editing.context,
                priority: editing.priority,
                status: editing.status,
                due_on: editing.due_on ?? "",
              }
            : {
                title: "",
                description: "",
                project_id: "",
                context: defaultContext,
                priority: "medium",
                status: "todo",
                due_on: "",
              }
        }
      />
    </>
  );
}

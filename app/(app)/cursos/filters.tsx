"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  type StatusFilter,
} from "@/features/courses/schema";

const STATUS_OPTIONS = STATUS_FILTERS.map((value) => ({ value, label: STATUS_FILTER_LABELS[value] }));

export function CourseFilters({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const hours = params.get("horas") ?? "";
  const status = (STATUS_FILTERS as readonly string[]).includes(params.get("status") ?? "")
    ? (params.get("status") as StatusFilter)
    : "abertos";

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <Segmented
        label="Filtrar por status"
        options={STATUS_OPTIONS}
        value={hours ? null : status}
        onChange={(value) => update({ status: value === "abertos" ? null : value, horas: null })}
        className="w-full overflow-x-auto md:w-auto"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          <span className="field-label">Categoria</span>
          <Select
            value={params.get("categoria") ?? ""}
            onChange={(e) => update({ categoria: e.target.value })}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field-label">Prioridade</span>
          <Select
            value={params.get("prioridade") ?? ""}
            onChange={(e) => update({ prioridade: e.target.value })}
          >
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </label>
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("horas") ?? "").trim();
            update({ horas: value, status: null });
          }}
        >
          <label htmlFor="horas-livres" className="field-label">
            Cabe no meu tempo (horas livres)
          </label>
          <div className="flex items-end gap-2">
            <input
              id="horas-livres"
              key={hours}
              name="horas"
              inputMode="decimal"
              defaultValue={hours}
              placeholder="ex.: 10"
              className="input"
            />
            <Button type="submit">Filtrar</Button>
            {hours ? (
              <Button variant="ghost" onClick={() => update({ horas: null })}>
                Limpar
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

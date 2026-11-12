"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateSettings, type SettingsFormState } from "@/features/settings/actions";

const initial: SettingsFormState = { status: "idle", message: "" };

export function SettingsForm({
  defaults,
  timezones,
}: {
  defaults: { obsidian_vault: string | null; safe_base_months: number; timezone: string };
  timezones: readonly string[];
}) {
  const [state, action, pending] = useActionState(updateSettings, initial);
  const toast = useToast();

  useEffect(() => {
    if (state.status === "saved") toast(state.message);
    if (state.status === "error" && !state.fieldErrors) toast(state.message, "alert");
  }, [state, toast]);

  return (
    <form action={action} className="flex max-w-md flex-col gap-5">
      <Field
        label="Vault do Obsidian"
        hint="Nome exato do vault, usado nos links obsidian://"
        error={state.fieldErrors?.obsidian_vault}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="obsidian_vault"
            defaultValue={state.values?.obsidian_vault ?? defaults.obsidian_vault ?? ""}
            placeholder="Estudos"
          />
        )}
      </Field>
      <Field
        label="Meses da base segura"
        hint="Janela usada no cálculo da renda segura (3 a 24)"
        error={state.fieldErrors?.safe_base_months}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="safe_base_months"
            type="number"
            inputMode="numeric"
            min={3}
            max={24}
            defaultValue={state.values?.safe_base_months ?? defaults.safe_base_months}
          />
        )}
      </Field>
      <Field label="Fuso horário" error={state.fieldErrors?.timezone}>
        {(a11y) => (
          <Select {...a11y} name="timezone" defaultValue={state.values?.timezone ?? defaults.timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("America/", "").replace("_", " ")}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

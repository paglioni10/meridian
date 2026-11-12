"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function InteractiveDemo() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen(true)}>Abrir modal</Button>
      <Button onClick={() => toast("Lançamento salvo.")}>Toast</Button>
      <Button variant="danger" onClick={() => toast("Falha ao salvar.", "alert")}>
        Toast de alerta
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Novo gasto"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Salvar
            </Button>
          </>
        }
      >
        <Field label="Descrição">{(a11y) => <Input {...a11y} placeholder="Mercado" />}</Field>
        <Field label="Valor" error="Informe um valor">
          {(a11y) => <Input {...a11y} inputMode="decimal" placeholder="0,00" />}
        </Field>
      </Dialog>
    </div>
  );
}

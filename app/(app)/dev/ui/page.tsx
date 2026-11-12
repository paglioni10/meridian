import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  DateMono,
  EmptyState,
  Kbd,
  Money,
  PageHead,
  Progress,
  Row,
  Section,
  Stat,
  Status,
  Tag,
} from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { InteractiveDemo } from "./interactive";

export const metadata: Metadata = { title: "UI" };

export default function UiCatalogPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <PageHead
        title="Componentes"
        meta="Catálogo do Design System · apenas em desenvolvimento"
        actions={<ThemeToggle />}
      />

      <div className="stats-grid">
        <Stat label="Saldo total" value={<Money cents={842015} />} size="display" hint="Nubank · PJ · CLT" />
        <Stat label="Entradas · CLT" value={<Money cents={520000} />} />
        <Stat label="Entradas · PJ" value={<Money cents={380000} />} />
        <Stat label="A vencer · 7 dias" value="3 contas" alert />
      </div>

      <div className="panels-grid">
        <Section title="Transações">
          <Row
            left={
              <>
                <DateMono value="2026-11-07" /> Mercado
              </>
            }
            right={<Money cents={-18240} />}
          />
          <Row
            left={
              <>
                <DateMono value="2026-11-06" /> Cliente Alfa
              </>
            }
            right={<Money cents={190000} sign />}
          />
          <Row
            left={
              <>
                <DateMono value="2026-11-05" /> Hospedagem VPS
              </>
            }
            right={<Money cents={-8990} />}
          />
        </Section>

        <Section title="Objetivos">
          <div className="flex flex-col gap-1.5">
            <Row left="Reserva de emergência" right="72%" className="border-0" />
            <Progress value={72} label="Reserva de emergência" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Row left="Notebook novo" right="40%" className="border-0" />
            <Progress value={40} tone="active" label="Notebook novo" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Row left="Orçamento lazer" right="112%" className="border-0" />
            <Progress value={100} tone="alert" label="Orçamento lazer" />
          </div>
        </Section>

        <Section title="Servidores">
          <Row left="vps-01" right={<Status state="online" />} />
          <Row left="n8n" right={<Status state="warning" />} />
          <Row left="backup-01" right={<Status state="offline" />} />
        </Section>

        <Section title="Tags e botões" wide>
          <div className="flex flex-wrap gap-2">
            <Tag>A vencer</Tag>
            <Tag tone="ink">Entregue</Tag>
            <Tag tone="blue">Em curso</Tag>
            <Tag tone="outline">Pessoal</Tag>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Padrão</Button>
            <Button variant="primary">Importar</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Excluir</Button>
            <Button disabled>Desabilitado</Button>
            <ButtonLink href="/ajustes">Link</ButtonLink>
            <Button icon aria-label="Adicionar">
              +
            </Button>
          </div>
          <p className="text-muted">
            Captura rápida: <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
          </p>
          <InteractiveDemo />
        </Section>

        <Section title="Formulário">
          <Field label="Descrição" hint="Texto livre">
            {(a11y) => <Input {...a11y} placeholder="Mercado" />}
          </Field>
          <Field label="Categoria">
            {(a11y) => (
              <Select {...a11y} defaultValue="alimentacao">
                <option value="alimentacao">Alimentação</option>
                <option value="moradia">Moradia</option>
              </Select>
            )}
          </Field>
          <Field label="Valor" error="Valor obrigatório">
            {(a11y) => <Input {...a11y} inputMode="decimal" />}
          </Field>
          <Field label="Notas">{(a11y) => <Textarea {...a11y} />}</Field>
        </Section>

        <Section title="Estado vazio">
          <EmptyState title="Nada por aqui" action={<Button variant="primary">Adicionar</Button>}>
            Nenhum curso no backlog ainda.
          </EmptyState>
        </Section>
      </div>
    </>
  );
}

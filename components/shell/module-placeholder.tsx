import { EmptyState, PageHead } from "@/components/ui/display";

export function ModulePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <>
      <PageHead title={title} meta={`Fase ${phase} · em construção`} />
      <EmptyState title="Em breve">{description}</EmptyState>
    </>
  );
}

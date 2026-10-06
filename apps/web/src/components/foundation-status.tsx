import { TechnicalStatus } from '@crm/ui';
export function FoundationStatus() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-semibold">CRM</h1>
      <TechnicalStatus>Sistema em configuração.</TechnicalStatus>
    </main>
  );
}

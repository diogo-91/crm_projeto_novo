'use client';
import { Select, Button, toast } from '@crm/ui';
import { useAuth } from './auth-provider';
import { errorMessage } from '@/lib/api-client';
export function OrganizationSwitcher({ showLogout = false }: { showLogout?: boolean }) {
  const { state, session } = useAuth();
  if (state.status !== 'authenticated') return null;
  const change = async (id: string) => {
    try {
      await session.selectOrganization(id);
      toast.success('Organização selecionada.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const logout = async () => {
    try {
      await session.logout();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      {state.me.memberships.length > 1 ? (
        <Select
          label="Organização atual"
          value={state.me.context?.organizationId ?? ''}
          placeholder="Escolha uma organização"
          options={state.me.memberships.map((m) => ({
            value: m.organizationId,
            label: m.organizationName,
          }))}
          onValueChange={(id) => {
            void change(id);
          }}
          className="w-full max-w-64"
        />
      ) : (
        <span className="truncate text-body font-medium">
          {state.me.context?.organizationName ?? 'Sem organização ativa'}
        </span>
      )}
      {showLogout && (
        <Button
          variant="outline"
          onClick={() => {
            void logout();
          }}
        >
          Sair
        </Button>
      )}
    </div>
  );
}

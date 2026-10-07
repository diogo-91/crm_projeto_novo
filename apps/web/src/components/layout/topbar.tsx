'use client';
import { NotificationsInbox } from '@/features/tasks/notifications-inbox';
import { usePathname } from 'next/navigation';
import { Menu, LogOut, ChevronDown, Store } from 'lucide-react';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  toast,
} from '@crm/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { OrganizationSwitcher } from '@/features/auth/organization-switcher';
import { errorMessage } from '@/lib/api-client';
import { currentPage } from '../navigation/navigation';
import { CommandMenu } from '../navigation/command-menu';
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const page = currentPage(usePathname());
  const { state, session } = useAuth();
  if (state.status !== 'authenticated') return null;
  const branch = state.me.context?.branches.find((b) => b.id === state.me.context?.primaryBranchId);
  const logout = async () => {
    try {
      await session.logout();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <header className="sticky top-0 z-(--layer-header) flex min-h-18 flex-wrap items-center justify-between gap-3 border-b bg-surface px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir navegação"
          className="lg:hidden"
          onClick={onMenu}
        >
          <Menu />
        </Button>
        <nav
          aria-label="Breadcrumb"
          className="hidden items-center gap-2 text-caption text-muted md:flex"
        >
          <span>{page?.group ?? 'Espaço de trabalho'}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-medium text-foreground">
            {page?.label ?? 'CRM'}
          </span>
        </nav>
      </div>
      <div className="flex min-w-0 max-w-full flex-1 items-center justify-end gap-2 md:gap-4">
        <CommandMenu />
        <NotificationsInbox />
        <div className="min-w-0 max-w-52">
          <OrganizationSwitcher />
          {branch && (
            <p className="mt-1 flex items-center gap-1 truncate text-caption text-muted">
              <Store aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{branch.name} · filial principal</span>
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto shrink-0 gap-2 p-1.5"
              aria-label="Menu do usuário"
            >
              <Avatar name={state.me.user.name} />
              <ChevronDown aria-hidden="true" className="hidden text-muted sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="px-3 py-2">
              <p className="text-body font-semibold">{state.me.user.name}</p>
              <p className="break-all text-caption text-muted">{state.me.user.email}</p>
              <p className="mt-2 text-caption text-muted">{state.me.context?.organizationName}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 h-px bg-border" />
            <DropdownMenuItem
              onSelect={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

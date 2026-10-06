'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet, TooltipProvider, cn } from '@crm/ui';
import { Sidebar } from '../navigation/sidebar';
import { Topbar } from './topbar';
import { useSidebarPreference } from '@/hooks/use-sidebar-preference';
export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, toggle } = useSidebarPreference();
  const [mobile, setMobile] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-(--layer-dialog) -translate-y-24 rounded-md bg-primary p-3 text-primary-foreground focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 lg:block',
            collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
          )}
        >
          <Sidebar collapsed={collapsed} toggle={toggle} />
        </aside>
        <Sheet open={mobile} onOpenChange={setMobile} title="Navegação principal">
          <Sidebar onNavigate={() => setMobile(false)} />
        </Sheet>
        <div className="min-w-0 flex-1">
          <Topbar onMenu={() => setMobile(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl p-5 md:p-8 xl:p-10"
          >
            {children}
          </main>
          <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 pb-6 text-caption text-muted md:px-8 xl:px-10">
            <span>CRM · Seu espaço de trabalho</span>
            <span>Uma operação mais próxima das pessoas.</span>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}

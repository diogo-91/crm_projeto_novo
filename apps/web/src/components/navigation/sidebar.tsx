'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, ArrowUpRight } from 'lucide-react';
import { Tooltip, cn } from '@crm/ui';
import { navigation, groups } from './navigation';
export function Sidebar({
  collapsed = false,
  toggle,
  onNavigate,
}: {
  collapsed?: boolean;
  toggle?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-20 shrink-0 items-center gap-3 px-5',
          collapsed && 'justify-center px-0',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground"
        >
          c
        </span>
        {!collapsed && (
          <Link
            href="/dashboard"
            {...(onNavigate ? { onClick: onNavigate } : {})}
            className="text-lg font-semibold tracking-tight text-surface"
          >
            crm<span className="ml-1 text-primary">.</span>
          </Link>
        )}
      </div>
      <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-caption font-medium text-sidebar-muted">{group}</p>
            )}
            <ul className="space-y-1">
              {navigation
                .filter((item) => item.group === group)
                .map((item) => {
                  const active = pathname === item.href;
                  const link = (
                    <Link
                      href={item.href}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center gap-3 rounded-md px-3 text-label transition-colors hover:bg-sidebar-hover hover:text-surface',
                        active && 'bg-primary/12 text-primary',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <item.icon aria-hidden="true" className="size-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-sidebar-hover p-3">
        {toggle ? (
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
            aria-expanded={!collapsed}
            className="flex h-10 w-full items-center justify-center gap-3 rounded-md text-caption text-sidebar-muted hover:bg-sidebar-hover hover:text-surface"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                Recolher menu
              </>
            )}
          </button>
        ) : (
          <p className="flex items-center gap-2 px-3 py-2 text-caption text-sidebar-muted">
            <ArrowUpRight className="size-3" />
            Seu próximo passo começa aqui.
          </p>
        )}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from '@crm/ui';
import { navigation } from './navigation';
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return (
    <>
      <Button
        variant="outline"
        className="hidden h-9 gap-6 text-muted xl:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Navegar pelos módulos"
      >
        <span className="flex items-center gap-2">
          <Search />
          Ir para...
        </span>
        <kbd className="rounded-sm border bg-surface-muted px-1.5 text-caption">⌘ / Ctrl K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="xl:hidden"
        onClick={() => setOpen(true)}
        aria-label="Navegar pelos módulos"
      >
        <Search />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="mb-1 text-base font-semibold">Ir para um módulo</DialogTitle>
          <DialogDescription className="mb-4 text-caption text-muted">
            Encontre uma página do seu espaço de trabalho.
          </DialogDescription>
          <Command>
            <CommandInput
              aria-label="Buscar páginas"
              placeholder="Digite o nome de uma página..."
            />
            <CommandList className="max-h-72 overflow-y-auto">
              <CommandEmpty className="p-6 text-center text-muted">
                Nenhuma página encontrada.
              </CommandEmpty>
              {navigation.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

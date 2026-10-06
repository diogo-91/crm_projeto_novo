'use client';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableState,
  Pagination,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  toast,
} from '@crm/ui';
import { FilterBar } from './filter-bar';
const components = [
  { name: 'Navegação', description: 'Sidebar e atalho de teclado' },
  { name: 'Feedback', description: 'Mensagens de sucesso, erro e informação' },
  { name: 'Formulários', description: 'Campos com rótulos e validação acessível' },
];
export function InterfaceDemo() {
  const [search, setSearch] = useState('');
  const rows = components.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Card className="mt-6">
      <CardHeader>
        <Badge variant="info" className="w-fit">
          Demonstração técnica
        </Badge>
        <CardTitle>Uma linguagem visual consistente</CardTitle>
        <CardDescription>
          Exemplos da interface. Esta demonstração não contém dados comerciais nem configurações
          administrativas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FilterBar
          search={
            <Input
              aria-label="Buscar componentes"
              placeholder="Buscar componentes..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
          actions={
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Sobre a interface</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="text-lg font-semibold">Clareza em cada detalhe</DialogTitle>
                <DialogDescription className="mt-3 text-body text-muted">
                  Navegação por teclado, estados explícitos e componentes consistentes. Use Tab para
                  navegar e Esc para fechar.
                </DialogDescription>
                <Button
                  className="mt-6"
                  onClick={() => toast.info('Você está na demonstração da interface.')}
                >
                  Testar feedback
                </Button>
              </DialogContent>
            </Dialog>
          }
        />
        <Table>
          <caption className="sr-only">Componentes da interface</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Componente</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.description}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableState columns={2}>
                <p className="py-4 text-muted">Nenhum componente encontrado.</p>
              </TableState>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-caption text-muted">Uma página de exemplos</span>
        <Pagination
          hasNextPage={false}
          hasPreviousPage={false}
          onNext={() => toast.info('Todos os exemplos estão nesta página.')}
          onPrevious={() => toast.info('Esta é a primeira página.')}
        />
      </CardFooter>
    </Card>
  );
}

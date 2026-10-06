import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  Button,
  FormField,
  Input,
  Select,
  Pagination,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './index';
it('prevents double submission while loading and communicates busy state', async () => {
  const click = vi.fn();
  render(
    <Button loading onClick={click}>
      Salvar
    </Button>,
  );
  await userEvent.click(screen.getByRole('button'));
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
});
it('associates label and error description with the input', () => {
  render(
    <FormField id="email" label="E-mail" error="E-mail inválido">
      <Input id="email" aria-invalid aria-describedby="email-error" />
    </FormField>,
  );
  expect(screen.getByLabelText('E-mail').getAttribute('aria-describedby')).toBe(
    screen.getByRole('alert').id,
  );
});
it('selects organization with platform-native keyboard semantics', async () => {
  const change = vi.fn();
  render(
    <Select
      label="Organização"
      value="a"
      options={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]}
      onValueChange={change}
    />,
  );
  await userEvent.selectOptions(screen.getByRole('combobox'), 'b');
  expect(change).toHaveBeenCalledWith('b');
});
it('does not navigate beyond available cursor pages', async () => {
  const next = vi.fn();
  const prev = vi.fn();
  render(<Pagination hasNextPage hasPreviousPage={false} onNext={next} onPrevious={prev} />);
  await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  expect(prev).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledOnce();
});
it('traps dialog focus, closes on Escape and returns focus to trigger', async () => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Detalhes</DialogTitle>
        <DialogDescription>Informação</DialogDescription>
        <Button>Ação</Button>
      </DialogContent>
    </Dialog>,
  );
  const trigger = screen.getByRole('button', { name: 'Abrir' });
  await user.click(trigger);
  expect(screen.getByRole('dialog')).toContain(document.activeElement);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('composes a loading indicator into an asChild link and prevents activation', async () => {
  const click = vi.fn();
  render(
    <Button asChild loading>
      <a href="/demo" onClick={click}>
        Abrir demo
      </a>
    </Button>,
  );
  const link = screen.getByRole('link', { name: 'Abrir demo' });
  expect(link.querySelector('svg')).not.toBeNull();
  expect(link.getAttribute('aria-busy')).toBe('true');
  expect(link.getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(link);
  expect(click).not.toHaveBeenCalled();
});

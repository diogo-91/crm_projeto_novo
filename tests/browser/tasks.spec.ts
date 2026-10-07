import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { login, fixture } from './support.js';
test('real follow-up journey records an interaction, delivers a reminder and versions completion', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const suffix = randomUUID().slice(0, 8),
    contact = 'Contato ' + suffix,
    task = 'Follow-up ' + suffix;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(contact);
  await dialog
    .getByRole('textbox', { name: 'Telefone' })
    .fill('+55119' + String(Date.now()).slice(-8));
  await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: contact, exact: true }).first().click();
  await page.getByRole('button', { name: 'Registrar interação', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Tipo de interação' }).selectOption('CALL');
  await dialog
    .getByRole('textbox', { name: 'Descrição da interação' })
    .fill('Ligação sintética registrada');
  await dialog.getByRole('button', { name: 'Registrar interação', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Ligação sintética registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Novo follow-up' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Título' }).fill(task);
  const local = await page.evaluate(() => {
    const d = new Date(Date.now() - 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  await dialog.getByLabel('Vencimento', { exact: true }).fill(local);
  await dialog.getByLabel('Lembrar em', { exact: true }).fill(local);
  await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Salvar tarefa' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Abrir tarefa', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: task, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir notificações' }).click();
  await page.getByRole('button', { name: 'Mostrar todas' }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: task, exact: true })).toBeVisible(
    { timeout: 35000 },
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Marcar como lida' }).last().click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Concluir tarefa', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Tarefa concluída', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reabrir tarefa', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Tarefa reaberta', { exact: true })).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByRole('link', { name: task, exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption((await fixture()).secondOrganizationId);
  await expect(page.getByText('Acesso negado', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: task, exact: true })).not.toBeVisible();
  expect(errors).toEqual([]);
});
for (const width of [375, 768, 1024, 1440, 1920])
  test(`tasks and notifications remain accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Tarefas', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Nova tarefa' })).toBeFocused();
    await page.getByRole('button', { name: 'Abrir notificações' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

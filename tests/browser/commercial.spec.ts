import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { login, fixture } from './support.js';
import { randomUUID } from 'node:crypto';
test('real commercial journey creates company, tag, client, edits, searches, archives and logs out', async ({
  page,
}) => {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const company = 'Empresa ' + suffix;
  const client = 'Cliente ' + suffix;
  const tag = 'Tag ' + suffix;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings/tags');
  await page.getByRole('button', { name: 'Nova tag' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(tag);
  await dialog.getByRole('combobox', { name: 'Aparência' }).selectOption('primary');
  await dialog.getByRole('button', { name: 'Salvar tag' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(tag, { exact: true })).toBeVisible();
  await page.goto('/companies');
  await page.getByRole('button', { name: 'Nova empresa' }).click();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(company);
  await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Salvar empresa' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('link', { name: company, exact: true }).first()).toBeVisible();
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(client);
  await dialog.getByRole('textbox', { name: 'Telefone' }).fill('+44 (20) 1234-5678');
  await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
  await expect(dialog.getByRole('combobox', { name: 'Empresa' })).toBeEnabled();
  await dialog.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: company });
  await dialog.getByRole('checkbox', { name: tag }).check();
  await dialog
    .getByRole('textbox', { name: 'Observações' })
    .fill('Texto simples, sem dados reais.');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(client);
  await expect(page).toHaveURL(/search=Cliente/);
  await page.getByRole('link', { name: client, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: client, exact: true })).toBeVisible();
  await expect(page.getByText('Texto simples, sem dados reais.')).toBeVisible();
  await expect(page.getByRole('link', { name: company, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar cliente' }).click();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(client + ' atualizado');
  await dialog.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: client + ' atualizado', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(tag, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: company, exact: true }).click();
  await expect(page.getByRole('heading', { name: company, exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: client + ' atualizado', exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar empresa' }).click();
  await dialog.getByRole('textbox', { name: 'Razão social' }).fill('Empresa de integração');
  await dialog.getByRole('button', { name: 'Salvar empresa' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Empresa de integração')).toBeVisible();
  await page
    .getByRole('link', { name: client + ' atualizado', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Desativar cliente', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar desativação' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para clientes' }).click();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Duplicado ' + suffix);
  await dialog.getByRole('textbox', { name: 'Telefone' }).fill('+442012345678');
  await dialog.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Já existe');
  await page.keyboard.press('Escape');
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption((await fixture()).secondOrganizationId);
  await expect(page.getByText('Acesso negado', { exact: true })).toBeVisible();
  await expect(page.getByText(client + ' atualizado', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo cliente' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
for (const width of [375, 768, 1024, 1440, 1920]) {
  test(`commercial forms and lists are accessible and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/contacts');
    await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo cliente' })).toBeFocused();
    await page.screenshot({ path: `.runtime/contacts-${width}.png`, fullPage: true });
    await page.goto('/companies');
    await expect(page.getByRole('heading', { name: 'Empresas', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

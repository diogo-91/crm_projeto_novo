import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { login, fixture } from './support.js';
test('catalog journey creates product and branch prices, edits exact decimals and archives safely', async ({
  page,
}) => {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const name = 'Produto ' + suffix;
  const list = 'Tabela ' + suffix;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/products');
  await page.getByRole('button', { name: 'Novo produto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nome do produto' }).fill(name);
  await dialog.getByRole('textbox', { name: 'SKU', exact: true }).fill('sku-' + suffix);
  await dialog.getByRole('button', { name: 'Salvar produto' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByText('SKU-' + suffix.toUpperCase(), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar produto' }).click();
  await expect(dialog.getByText('Unidade: UN (fixa)')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Descrição' }).fill('Descrição de catálogo');
  await dialog.getByRole('button', { name: 'Salvar produto' }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto('/products/price-lists');
  await page.getByRole('button', { name: 'Nova tabela' }).click();
  await dialog.getByRole('textbox', { name: 'Nome da tabela' }).fill(list);
  await expect(dialog.getByRole('button', { name: 'Salvar tabela' })).toBeEnabled();
  const options = await dialog
    .getByRole('combobox', { name: 'Disponível para' })
    .locator('option')
    .all();
  expect(options.length).toBeGreaterThan(1);
  const branchValue = await options[1]?.getAttribute('value');
  if (!branchValue) throw new Error('Branch option unavailable');
  await dialog.getByRole('combobox', { name: 'Disponível para' }).selectOption(branchValue);
  await dialog.getByRole('button', { name: 'Salvar tabela' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: list, exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar preço' }).click();
  await dialog.getByRole('textbox', { name: 'Buscar produto' }).fill(suffix);
  await expect(dialog.getByRole('combobox', { name: 'Produto', exact: true })).toBeEnabled();
  await dialog
    .getByRole('combobox', { name: 'Produto', exact: true })
    .selectOption({ label: `SKU-${suffix.toUpperCase()} · ${name}` });
  await dialog.getByRole('textbox', { name: 'Preço unitário' }).fill('123.123456');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Salvar preço' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('SKU-' + suffix.toUpperCase() + ' · UN · BRL 123.123456'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar preço' }).click();
  await dialog.getByRole('textbox', { name: 'Preço unitário' }).fill('123.1234567');
  await dialog.getByRole('button', { name: 'Salvar preço' }).click();
  await expect(
    dialog.getByText('Informe um preço não negativo com até seis casas decimais.'),
  ).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Preço unitário' }).fill('200.000001');
  await dialog.getByRole('button', { name: 'Salvar preço' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Arquivar preço', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar arquivamento' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Preço arquivado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reativar preço' }).click();
  await dialog.getByRole('button', { name: 'Salvar preço' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Arquivar tabela', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar arquivamento' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar preço' })).toHaveCount(0);
  await expect(page.getByText(/BRL 200.000001/)).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption((await fixture()).secondOrganizationId);
  await expect(page.getByText('Acesso negado', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const width of [375, 768, 1440])
  test(`catalog pages and dialogs are accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    for (const [route, title, button] of [
      ['/products', 'Produtos', 'Novo produto'],
      ['/products/price-lists', 'Tabelas de preços', 'Nova tabela'],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.getByRole('button', { name: button }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: button })).toBeFocused();
    }
  });

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { login, fixture } from './support.js';
test('real sales journey configures pipeline, qualifies, converts and moves a deal with history', async ({
  page,
}) => {
  await login(page);
  const suffix = randomUUID().slice(0, 8),
    pipeline = 'Funil ' + suffix,
    lead = 'Lead ' + suffix;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/pipeline');
  await page.getByRole('button', { name: 'Novo pipeline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nome do pipeline' }).fill(pipeline);
  await dialog.getByRole('button', { name: 'Salvar pipeline' }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('combobox', { name: 'Pipeline', exact: true })
    .selectOption({ label: pipeline });
  await page.getByRole('button', { name: 'Configurar pipeline', exact: true }).click();
  await page.getByRole('button', { name: 'Mover Ganha para a esquerda' }).click();
  await expect(page.getByRole('heading', { name: 'Configurar pipeline' })).toBeVisible();
  await page.goto('/leads');
  await page.getByRole('button', { name: 'Novo lead' }).click();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(lead);
  await dialog
    .getByRole('textbox', { name: 'Telefone' })
    .fill('+55119' + String(Date.now()).slice(-8));
  await dialog
    .getByRole('textbox', { name: 'Nome da empresa prospectada' })
    .fill('Empresa ' + suffix);
  await expect(dialog.getByRole('combobox', { name: 'Responsável' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Salvar lead' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: lead, exact: true }).first().click();
  await page.getByRole('button', { name: 'Editar lead' }).click();
  await dialog.getByRole('combobox', { name: 'Qualificação' }).selectOption('QUALIFIED');
  await dialog.getByRole('button', { name: 'Salvar lead' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Converter lead', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Pipeline', exact: true })
    .selectOption({ label: pipeline });
  await dialog
    .getByRole('combobox', { name: 'Etapa', exact: true })
    .selectOption({ label: 'Entrada' });
  await dialog.getByRole('textbox', { name: 'Valor', exact: true }).fill('1234.5678');
  await dialog.getByRole('checkbox', { name: 'Criar cliente com os dados do lead' }).check();
  await dialog.getByRole('checkbox', { name: 'Criar empresa com os dados do lead' }).check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Confirmar conversão' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: lead, exact: true }).click();
  await expect(page.getByRole('heading', { name: lead, exact: true })).toBeVisible();
  await expect(page.getByText('BRL 1234.5678')).toBeVisible();
  await page.goto('/pipeline');
  await page
    .getByRole('combobox', { name: 'Pipeline', exact: true })
    .selectOption({ label: pipeline });
  await page.getByRole('button', { name: 'Mover ' + lead, exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Nova etapa' }).selectOption({ label: 'Perdida' });
  await dialog.getByRole('button', { name: 'Confirmar movimentação' }).click();
  await expect(dialog.getByText('Informe o motivo da perda.')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Motivo da perda' }).fill('Prazo incompatível');
  await dialog.getByRole('button', { name: 'Confirmar movimentação' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Etapa Perdida' })
      .getByRole('link', { name: lead, exact: true }),
  ).toBeVisible();
  const lostCard = page
    .getByRole('region', { name: 'Etapa Perdida' })
    .locator('li')
    .filter({ has: page.getByRole('link', { name: lead, exact: true }) });
  await lostCard.dragTo(page.getByRole('region', { name: 'Etapa Ganha' }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Nova etapa' })).toHaveValue(/.+/);
  await dialog.getByRole('button', { name: 'Confirmar movimentação' }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('region', { name: 'Etapa Ganha' })
    .getByRole('link', { name: lead, exact: true })
    .click();
  await expect(page.getByText('Ganha', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Histórico de etapas' })).toBeVisible();
  await expect(page.getByText('Prazo incompatível', { exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption((await fixture()).secondOrganizationId);
  await expect(page.getByText('Acesso negado', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const width of [375, 768, 1024, 1440, 1920])
  test(`sales interfaces are accessible with bounded Kanban at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [route, title] of [
      ['/leads', 'Leads'],
      ['/crm', 'Oportunidades'],
      ['/pipeline', 'Pipeline'],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.getByRole('button', { name: 'Novo pipeline' }).click();
    const dialog = page.getByRole('dialog');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo pipeline' })).toBeFocused();
    expect(errors).toEqual([]);
  });

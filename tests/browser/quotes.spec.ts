import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID, randomInt } from 'node:crypto';
import { createDatabaseClient } from '@crm/database';
import { login, fixture } from './support.js';
test('real quote journey creates exact totals, approves, revises and preserves catalog snapshots', async ({
  page,
}) => {
  const data = await fixture(),
    database = createDatabaseClient(data.databaseUrl),
    suffix = randomUUID().slice(0, 8);
  const organizationId = data.firstOrganizationId;
  const member = await database.organizationMembership.findFirstOrThrow({
    where: { organizationId, user: { email: data.email } },
    include: { branches: true },
  });
  const branchId = member.branches[0]?.branchId;
  if (!branchId) throw new Error('Demo branch missing');
  const product = await database.product.create({
    data: {
      organizationId,
      sku: 'QUOTE-' + suffix.toUpperCase(),
      name: 'Snapshot product ' + suffix,
      unit: 'UN',
      createdByMembershipId: member.id,
      updatedByMembershipId: member.id,
    },
  });
  const list = await database.priceList.create({
    data: {
      organizationId,
      name: 'Quote list ' + suffix,
      normalizedName: 'quote list ' + suffix,
      currency: 'BRL',
      createdByMembershipId: member.id,
      updatedByMembershipId: member.id,
    },
  });
  await database.priceListItem.create({
    data: {
      organizationId,
      priceListId: list.id,
      productId: product.id,
      unitPrice: '10.005000',
      updatedByMembershipId: member.id,
    },
  });
  const phone = '+44' + String(randomInt(100000000, 999999999));
  const buyer = await database.contact.create({
    data: {
      organizationId,
      branchId,
      ownerMembershipId: member.id,
      name: 'Quote buyer ' + suffix,
      phone,
      normalizedPhone: phone,
      createdByMembershipId: member.id,
      updatedByMembershipId: member.id,
    },
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await login(page);
    await page.goto('/quotes');
    await page.getByRole('button', { name: 'Novo orçamento' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Nome do orçamento' }).fill('Proposta ' + suffix);
    await expect(dialog.getByRole('combobox', { name: 'Filial', exact: true })).toBeEnabled();
    await dialog.getByRole('combobox', { name: 'Filial', exact: true }).selectOption(branchId);
    await dialog.getByRole('textbox', { name: 'Buscar cliente para associação' }).fill(suffix);
    await expect(dialog.getByRole('combobox', { name: 'Cliente', exact: true })).toContainText(
      buyer.name,
    );
    await dialog.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(buyer.id);
    await expect(dialog.getByRole('combobox', { name: 'Tabela de preços' })).toContainText(
      list.name,
    );
    await dialog.getByRole('combobox', { name: 'Tabela de preços' }).selectOption(list.id);
    await expect(dialog.getByRole('combobox', { name: 'Produto 1' })).toContainText(product.sku);
    await dialog.getByRole('combobox', { name: 'Produto 1' }).selectOption(product.id);
    await dialog.getByRole('textbox', { name: 'Quantidade 1' }).fill('2');
    await dialog.getByRole('textbox', { name: 'Desconto % 1' }).fill('10');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Salvar orçamento' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
    const originalUrl = page.url();
    await expect(page.getByText('BRL 18.01', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aprovar orçamento' }).click();
    await dialog.getByRole('button', { name: 'Confirmar aprovação' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar orçamento' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar para orçamentos' })).toBeFocused();
    await database.product.update({
      where: { id: product.id },
      data: { name: 'Changed after approval', version: { increment: 1 } },
    });
    await database.priceListItem.update({
      where: {
        organizationId_priceListId_productId: {
          organizationId,
          priceListId: list.id,
          productId: product.id,
        },
      },
      data: { unitPrice: '99' },
    });
    await page.reload();
    await expect(page.getByText(product.sku + ' · ' + product.name)).toBeVisible();
    await page.getByRole('button', { name: 'Criar revisão' }).click();
    await dialog.getByRole('button', { name: 'Confirmar revisão' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).not.toHaveURL(originalUrl);
    await expect(page.getByText('BRL 18.01', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar orçamento' }).click();
    await dialog.getByRole('textbox', { name: 'Quantidade 1' }).fill('3');
    await dialog.getByRole('button', { name: 'Salvar orçamento' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('BRL 27.02', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Ver revisão anterior preservada' }).click();
    await expect(page).toHaveURL(originalUrl);
    await expect(page.getByText('BRL 18.01', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole('combobox', { name: 'Organização atual' })
      .selectOption(data.secondOrganizationId);
    await expect(page.getByText('Acesso negado', { exact: true })).toBeVisible();
    await expect(page.getByText(buyer.name, { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await database.$disconnect();
  }
});
for (const width of [375, 768, 1440])
  test(`quote page and dialog remain accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/quotes');
    await expect(page.getByRole('heading', { name: 'Orçamentos', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Novo orçamento' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo orçamento' })).toBeFocused();
  });

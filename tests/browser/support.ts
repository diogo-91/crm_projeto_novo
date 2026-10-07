import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const fixtureSchema = z.object({
  email: z.email(),
  password: z.string(),
  databaseUrl: z.string(),
  firstOrganizationId: z.uuid(),
  secondOrganizationId: z.uuid(),
});
export async function fixture() {
  return fixtureSchema.parse(
    JSON.parse(await readFile('.runtime/browser-fixture.json', 'utf8')) as unknown,
  );
}
export async function login(page: Page) {
  const data = await fixture();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar no seu espaço' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'E-mail' }).fill(data.email);
  await page.getByLabel(/^Senha/).fill(data.password);
  await page.getByRole('button', { name: 'Entrar no seu espaço' }).click();
  await expect(page.getByRole('heading', { name: 'Seu espaço de trabalho' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption(data.firstOrganizationId);
  await expect(page.getByRole('heading', { name: 'Seu trabalho, em perspectiva.' })).toBeVisible();
}

import { fixture, login } from './support.js';
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { authResponseSchema } from '@crm/contracts';
import { createDatabaseClient } from '@crm/database';
test('redirects guest protected routes and renders a safe 404', async ({ page }) => {
  await page.goto('/contacts');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/unknown');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('validates fields and reports invalid real credentials', async ({ page }) => {
  await page.goto('/login');
  const button = page.getByRole('button', { name: 'Entrar no seu espaço' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  await expect(page.getByText('Informe sua senha.')).toBeVisible();
  await page.getByRole('textbox', { name: 'E-mail' }).fill('nobody@example.test');
  await page.getByLabel(/^Senha/).fill('wrong-password');
  await button.click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Credenciais inválidas.');
});
test('navigates every module and persists sidebar preference through real refresh', async ({
  page,
}) => {
  await login(page);
  const routes = [
    ['CRM', 'crm'],
    ['Clientes', 'contacts'],
    ['Empresas', 'companies'],
    ['Leads', 'leads'],
    ['Pipeline', 'pipeline'],
    ['Conversas', 'conversations'],
    ['Tarefas', 'tasks'],
    ['Orçamentos', 'quotes'],
    ['Produtos', 'products'],
    ['Automações', 'automations'],
    ['Relatórios', 'reports'],
    ['Equipe', 'team'],
    ['Configurações', 'settings'],
  ] as const;
  for (const [label, path] of routes) {
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Recolher navegação' }).click();
  await expect(page.getByRole('button', { name: 'Expandir navegação' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expandir navegação' })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir navegação' }).click();
});
test('opens command and dialog with keyboard, traps focus and closes with Escape', async ({
  page,
}) => {
  await login(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByRole('combobox', { name: 'Buscar páginas' }).fill('Configurações');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole('button', { name: 'Sobre a interface' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Sobre a interface' })).toBeFocused();
});
test('switches same global identity from ADMIN A to VIEWER B without sharing capabilities', async ({
  page,
}) => {
  await login(page);
  const data = await fixture();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/auth/context') && r.status() === 200,
  );
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption(data.secondOrganizationId);
  const auth = authResponseSchema.parse((await (await response).json()) as unknown);
  expect(auth.context?.roles.map((r) => r.code)).toEqual(['VIEWER']);
  expect(auth.context?.permissions).toEqual(['users.read']);
  expect(auth.context?.permissions).not.toContain('users.manage');
  await expect(page.getByRole('combobox', { name: 'Organização atual' })).toHaveValue(
    data.secondOrganizationId,
  );
  await page
    .getByRole('combobox', { name: 'Organização atual' })
    .selectOption(data.firstOrganizationId);
  await expect(page.getByRole('combobox', { name: 'Organização atual' })).toHaveValue(
    data.firstOrganizationId,
  );
});
test('coordinates refresh across tabs and propagates real logout', async ({ page, context }) => {
  await login(page);
  const second = await context.newPage();
  await second.goto('/dashboard');
  await expect(
    second.getByRole('heading', { name: 'Seu trabalho, em perspectiva.' }),
  ).toBeVisible();
  await Promise.all([page.reload(), second.reload()]);
  await expect(page.getByRole('heading', { name: 'Seu trabalho, em perspectiva.' })).toBeVisible();
  await expect(
    second.getByRole('heading', { name: 'Seu trabalho, em perspectiva.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(second).toHaveURL(/\/login$/);
  expect((await context.cookies()).some((c) => c.name === 'crm_refresh')).toBe(false);
});
test('handles revoked session through real refresh and protected route redirect', async ({
  page,
}) => {
  await login(page);
  const data = await fixture();
  const db = createDatabaseClient(data.databaseUrl);
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: data.email } });
    await db.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } finally {
    await db.$disconnect();
  }
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});
test('displays friendly rate-limit and network failure feedback', async ({ page }) => {
  await page.goto('/login');
  const data = await fixture();
  const button = page.getByRole('button', { name: 'Entrar no seu espaço' });
  await expect(button).toBeEnabled();
  await page.getByRole('textbox', { name: 'E-mail' }).fill(data.email);
  await page.getByLabel(/^Senha/).fill(data.password);
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 429, body: '{}', contentType: 'application/json' }),
  );
  await button.click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Muitas tentativas');
  await page.unroute('**/auth/login');
  await page.route('**/auth/login', (route) => route.abort('failed'));
  await button.click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Verifique sua conexão');
});
test('shows readable toast feedback and allows accessible dismissal', async ({ page }) => {
  await login(page);
  const notification = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Organização selecionada.' });
  await expect(notification).toHaveCSS('opacity', '1');
  expect(
    (await new AxeBuilder({ page }).include('[data-sonner-toast]').analyze()).violations,
  ).toEqual([]);
  await notification.getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(notification).toHaveCount(0);
});
for (const width of [375, 768, 1024, 1440, 1920]) {
  test(`responsive navigation, contrast and focus at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      const visitorRefresh =
        message.text() ===
          'Failed to load resource: the server responded with a status of 401 (Unauthorized)' &&
        message.location().url.endsWith('/auth/refresh');
      if (message.type() === 'error' && !visitorRefresh) errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar no seu espaço' })).toBeEnabled();
    await expect(page.getByRole('main')).toBeVisible();
    expect(
      await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/geist/i);
    expect(
      await page.evaluate(async () => {
        await document.fonts.ready;
        return Array.from(document.fonts).some(
          (font) =>
            /geist/i.test(font.family) &&
            !/fallback/i.test(font.family) &&
            font.status === 'loaded',
        );
      }),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `.runtime/login-${width}.png`, fullPage: true });
    await login(page);
    if (width < 1024) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await page.getByRole('button', { name: 'Abrir navegação' }).click();
      await dialog.getByRole('link', { name: 'Clientes', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(/\/contacts$/);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    // Evaluate the settled page, after the finite success toast has completed its exit animation.
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `.runtime/app-${width}.png`, fullPage: true });
    for (const [route, heading] of [
      ['/dashboard', 'Seu trabalho, em perspectiva.'],
      ['/settings', 'Configurações'],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `.runtime/${route.slice(1)}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(storage.local.every((k) => k === 'crm-sidebar-collapsed')).toBe(true);
    expect(storage.session).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).not.toContain('crm_refresh');
  });
}

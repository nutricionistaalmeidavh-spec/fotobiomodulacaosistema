import { test, expect } from '@playwright/test';

test.describe('UI-5 equipment workspace', () => {
  test('renders real F0 equipment with explicit technical fields', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="equipment"]').click();
    await expect(page.getByRole('heading', { name: 'Equipamentos e aplicadores' })).toBeVisible();
    const card = page.locator('[data-equipment-card]').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/nm/);
    await expect(card).toContainText(/mW/);
    await expect(card.locator('[data-equipment-applicator]')).not.toHaveText('—');
    await expect(card.getByText(/Dados técnicos (completos|incompletos)/)).toBeVisible();
    await expect(page.getByText(/compatível para tratamento/i)).toHaveCount(0);
  });

  test('equipment screen remains usable on mobile without global overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await page.locator('[data-nav="equipment"]').click();
    await expect(page.locator('[data-equipment-card]').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

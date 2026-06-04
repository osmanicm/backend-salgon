import { test, expect } from "@playwright/test";

test.describe("Citas", () => {
  const clientName = `Cliente-E2E-${Date.now()}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  test.beforeEach(async ({ page }) => {
    await page.goto("/appointments");
    await page.waitForLoadState("networkidle");
  });

  test("crea una nueva cita", async ({ page }) => {
    await page.getByRole("button", { name: /nueva cita/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Usar placeholders porque los Label no tienen htmlFor
    await dialog.getByPlaceholder("Ej. Juan Pérez").fill(clientName);
    await dialog.getByPlaceholder("+52 55 1234 5678").fill("+52 55 9876 5432");

    // Seleccionar la primera propiedad disponible
    await dialog.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    await dialog.locator('input[type="date"]').fill(dateStr);
    await dialog.locator('input[type="time"]').fill("10:00");

    await dialog.getByRole("button", { name: /agendar/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("edita una cita existente", async ({ page }) => {
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 5_000 });

    const row = page.locator("li", { hasText: clientName });
    await row.getByRole("button", { name: /editar/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator('input[type="time"]').fill("11:30");
    await dialog.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test("elimina una cita", async ({ page }) => {
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 5_000 });

    const row = page.locator("li", { hasText: clientName });
    await row.getByRole("button", { name: /eliminar/i }).click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^eliminar$/i }).click();

    await expect(page.locator("li", { hasText: clientName })).not.toBeVisible({ timeout: 8_000 });
  });
});

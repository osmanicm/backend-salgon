import { test, expect } from "@playwright/test";

test.describe("Citas", () => {
  const clientName = `Cliente-E2E-${Date.now()}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10); // yyyy-MM-dd

  test.beforeEach(async ({ page }) => {
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: /citas/i })).toBeVisible();
  });

  test("crea una nueva cita", async ({ page }) => {
    await page.getByRole("button", { name: /nueva cita/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/cliente/i).fill(clientName);
    await dialog.getByLabel(/teléfono/i).fill("+52 55 9876 5432");

    // Seleccionar la primera propiedad disponible
    await dialog.getByRole("combobox", { name: /propiedad/i }).click();
    await page.getByRole("option").first().click();

    await dialog.getByLabel(/fecha/i).fill(dateStr);
    await dialog.getByLabel(/hora/i).fill("10:00");

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

    await dialog.getByLabel(/hora/i).fill("11:30");
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

    await expect(page.getByText(clientName)).not.toBeVisible({ timeout: 8_000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Leads CRUD", () => {
  const unique = `E2E-${Date.now()}`;
  const editedInterest = "Departamento en Polanco (editado)";

  test.beforeEach(async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /prospectos/i })).toBeVisible();
  });

  test("crea un nuevo prospecto", async ({ page }) => {
    await page.getByRole("button", { name: /agregar prospecto/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/nombre completo/i).fill(`${unique} Test`);
    await dialog.getByLabel(/teléfono/i).fill("+52 55 1234 5678");
    await dialog.getByLabel(/correo electrónico/i).fill(`${unique.toLowerCase()}@test.com`);
    await dialog.getByLabel(/interés/i).fill("Casa de 3 recámaras");
    await dialog.getByLabel(/presupuesto/i).fill("3000000");

    await dialog.getByRole("button", { name: /guardar prospecto/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(`${unique} Test`)).toBeVisible();
  });

  test("edita un prospecto existente", async ({ page }) => {
    await expect(page.getByText(`${unique} Test`)).toBeVisible({ timeout: 5_000 });

    // Abre el menú de edición de la fila correcta
    const row = page.locator("tr", { hasText: `${unique} Test` });
    await row.getByRole("button", { name: /editar/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const interestField = dialog.getByLabel(/interés/i);
    await interestField.clear();
    await interestField.fill(editedInterest);
    await dialog.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(editedInterest)).toBeVisible();
  });

  test("elimina un prospecto", async ({ page }) => {
    await expect(page.getByText(`${unique} Test`)).toBeVisible({ timeout: 5_000 });

    const row = page.locator("tr", { hasText: `${unique} Test` });
    await row.getByRole("button", { name: /eliminar/i }).click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^eliminar$/i }).click();

    await expect(page.getByText(`${unique} Test`)).not.toBeVisible({ timeout: 8_000 });
  });
});

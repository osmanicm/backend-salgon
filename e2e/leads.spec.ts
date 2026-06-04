import { test, expect } from "@playwright/test";

// Serial: los 3 tests comparten el mismo worker y el estado ctx persiste entre ellos
test.describe.serial("Leads CRUD", () => {
  const ctx = { unique: "" };
  const editedInterest = "Departamento en Polanco (editado)";

  test.beforeEach(async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");
  });

  test("crea un nuevo prospecto", async ({ page }) => {
    ctx.unique = `E2E-${Date.now()}`;

    await page.getByRole("button", { name: /agregar prospecto/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Juan Pérez").fill(`${ctx.unique} Test`);
    await dialog.getByPlaceholder("+52 55 0000 0000").fill("+52 55 1234 5678");
    await dialog.getByPlaceholder("correo@ejemplo.com").fill(`${ctx.unique.toLowerCase()}@test.com`);
    await dialog.getByPlaceholder(/recámaras|Polanco/i).fill("Casa de 3 recámaras");
    await dialog.getByPlaceholder("2500000").fill("3000000");

    await dialog.getByRole("button", { name: /guardar prospecto/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    // Apuntar a la fila de tabla (desktop) — el card mobile está hidden en viewport ancho
    await expect(page.locator("tr", { hasText: `${ctx.unique} Test` })).toBeVisible();
  });

  test("edita un prospecto existente", async ({ page }) => {
    await expect(page.locator("tr", { hasText: `${ctx.unique} Test` })).toBeVisible({ timeout: 5_000 });

    const row = page.locator("tr", { hasText: `${ctx.unique} Test` });
    await row.getByRole("button", { name: /editar/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const interestField = dialog.getByPlaceholder(/recámaras|Polanco/i);
    await interestField.clear();
    await interestField.fill(editedInterest);
    await dialog.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator("table").getByText(editedInterest)).toBeVisible();
  });

  test("elimina un prospecto", async ({ page }) => {
    await expect(page.locator("tr", { hasText: `${ctx.unique} Test` })).toBeVisible({ timeout: 5_000 });

    const row = page.locator("tr", { hasText: `${ctx.unique} Test` });
    await row.getByRole("button", { name: /eliminar/i }).click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^eliminar$/i }).click();

    await expect(page.locator("tr", { hasText: `${ctx.unique} Test` })).not.toBeVisible({ timeout: 8_000 });
  });
});

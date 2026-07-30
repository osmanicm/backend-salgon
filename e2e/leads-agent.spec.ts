import { test, expect } from "@playwright/test";

// Corre con el storageState del AGENTE (proyecto chromium-agent).
// Verifica que un agente accede a /leads, ve solo su vista acotada, el formulario
// no expone el selector de agente, y puede crear/eliminar sus propios prospectos.
test.describe.serial("Prospectos — acceso de agente", () => {
  const unique = `E2E-AG-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");
  });

  test("accede a /leads y ve 'Mis Prospectos' (no 403)", async ({ page }) => {
    await expect(page.getByText("Mis Prospectos")).toBeVisible();
    // La columna "Agente" se oculta a los agentes
    await expect(page.getByRole("columnheader", { name: "Agente" })).toHaveCount(0);
  });

  test("el formulario NO muestra el selector 'Agente asignado'", async ({ page }) => {
    await page.getByRole("button", { name: /agregar prospecto/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Agente asignado/i)).toHaveCount(0);
    await dialog.getByRole("button", { name: /cancelar/i }).click();
  });

  test("crea un prospecto que queda en su lista", async ({ page }) => {
    await page.getByRole("button", { name: /agregar prospecto/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Juan Pérez").fill(`${unique} Test`);
    await dialog.getByPlaceholder("+52 55 0000 0000").fill("+52 55 1234 5678");
    await dialog.getByPlaceholder("correo@ejemplo.com").fill(`${unique.toLowerCase()}@test.com`);
    await dialog.getByPlaceholder(/recámaras|Polanco/i).fill("Casa de 3 recámaras");
    await dialog.getByPlaceholder("2500000").fill("3000000");

    await dialog.getByRole("button", { name: /guardar prospecto/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator("tr", { hasText: `${unique} Test` })).toBeVisible();
  });

  test("limpieza: elimina el prospecto creado", async ({ page }) => {
    const row = page.locator("tr", { hasText: `${unique} Test` });
    await expect(row).toBeVisible({ timeout: 5_000 });

    await row.getByRole("button", { name: /eliminar/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /eliminar/i }).click();

    await expect(page.locator("tr", { hasText: `${unique} Test` })).toHaveCount(0, { timeout: 8_000 });
  });
});

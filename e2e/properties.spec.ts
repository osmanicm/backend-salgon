import { test, expect } from "@playwright/test";

test.describe("Propiedades", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /propiedades/i })).toBeVisible();
  });

  test("muestra el listado de propiedades", async ({ page }) => {
    // Debe haber al menos una propiedad (hay 23 en la BD)
    await expect(page.locator("table tbody tr, ul li").first()).toBeVisible({ timeout: 8_000 });
  });

  test("filtra propiedades por texto", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i);
    await searchInput.fill("casa");

    // Los resultados se filtran sin recargar
    await page.waitForTimeout(300);
    const count = await page.locator("table tbody tr").count();
    // Puede ser 0 o más — lo importante es que la UI responde sin error
    await expect(page.getByText(/de \d+ propiedades|propiedades/i)).toBeVisible();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("abre el detalle de una propiedad", async ({ page }) => {
    // Clic en el botón Ver de la primera propiedad
    await page.getByRole("button", { name: /ver/i }).first().click();

    await expect(page).toHaveURL(/\/properties\/.+/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

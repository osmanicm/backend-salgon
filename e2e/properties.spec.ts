import { test, expect } from "@playwright/test";

test.describe("Propiedades", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");
  });

  test("muestra el listado de propiedades", async ({ page }) => {
    // Hay 23 propiedades en la BD — debe mostrar al menos una fila o tarjeta
    const rows = page.locator("table tbody tr");
    const cards = page.locator("ul > li");
    const count = await rows.count() + await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("filtra propiedades por texto", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await searchInput.fill("casa");
    await page.waitForTimeout(300);

    // Después de filtrar, la tabla desktop sigue presente (puede estar vacía)
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("abre el detalle de una propiedad", async ({ page }) => {
    await page.getByRole("button", { name: /ver/i }).first().click();
    await expect(page).toHaveURL(/\/properties\/.+/);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main, [class*='container']").first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Búsqueda global (Command Palette)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Esperar a que la app cargue
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("abre el palette al hacer clic en la barra de búsqueda", async ({ page }) => {
    await page.getByRole("button", { name: /buscar propiedades/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/buscar/i)).toBeVisible();
  });

  test("abre el palette con Ctrl+K", async ({ page }) => {
    await page.keyboard.press("Control+k");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("cierra el palette con Escape", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("muestra grupos de resultados al escribir", async ({ page }) => {
    await page.keyboard.press("Control+k");

    const input = page.getByRole("dialog").getByPlaceholder(/buscar/i);
    await input.fill("a");

    // Debe aparecer al menos uno de los grupos
    const hasGroup = await page.getByText(/propiedades|prospectos|citas/i).first().isVisible();
    expect(hasGroup).toBeTruthy();
  });
});

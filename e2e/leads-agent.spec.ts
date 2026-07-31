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

test.describe.serial("Embudo — acceso de agente", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
  });

  test("accede a /pipeline (no 403) y ve las columnas del embudo", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Embudo de Ventas" })).toBeVisible();
    // El layout renderiza columnas tanto para mobile como desktop (una oculta por CSS),
    // por lo que el texto aparece duplicado en el DOM.
    await expect(page.getByText("Nuevo Prospecto").last()).toBeVisible();
    await expect(page.getByText("Negociación").last()).toBeVisible();
  });

  test("fija un próximo contacto desde la tarjeta y persiste", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // Abre el editor de seguimiento de la primera tarjeta. El layout renderiza las columnas
    // dos veces (mobile oculto + desktop visible) y la tarjeta arrastrable de dnd-kit también
    // expone role="button" con un nombre accesible que concatena todo su texto (incluida la
    // palabra "Seguimiento"), así que se escoge explícitamente el tablero de escritorio visible
    // y se exige name exacto para distinguir el botón real del contenedor de la tarjeta.
    const desktopBoard = page.locator("div.hidden.md\\:grid");
    const followBtn = desktopBoard.getByRole("button", { name: "Seguimiento", exact: true }).first();
    await expect(followBtn).toBeVisible();

    // Captura la identidad de la tarjeta sobre la que se actúa (su nombre de prospecto) para
    // luego, tras recargar, verificar el badge específicamente en ESA tarjeta y no en
    // cualquier tarjeta del tablero.
    const card = followBtn.locator("xpath=ancestor::div[@role='button'][1]");
    const leadName = (await card.locator(".text-sm.font-medium").first().innerText()).trim();
    expect(leadName.length).toBeGreaterThan(0);

    await followBtn.click();

    const popover = page.getByRole("dialog");

    // Si una corrida previa dejó un seguimiento fijado, lo limpia primero: seleccionar un día
    // ya elegido en el calendario no dispara onSelect (o lo deselecciona), así que sin este
    // reseteo el guardado no se repite y el toast no aparece.
    const clearBtn = popover.getByRole("button", { name: "Limpiar fecha" });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /seguimiento guardado/i }).first()).toBeVisible({ timeout: 8_000 });
    }

    // Elige el día 28 del mes en curso. El aria-label del gridcell de react-day-picker es la
    // fecha completa formateada (p.ej. "Tuesday, July 28th, 2026"), no el número de día, así
    // que se filtra por el texto visible "28" excluyendo los días del mes anterior/siguiente
    // que también se muestran en la grilla (marcados con data-outside en el <td>; el <button>
    // interno trae su propio data-day con otro formato y sin ese atributo).
    const dayCell = popover
      .locator("td[data-day]:not([data-outside])")
      .filter({ hasText: /^28$/ });
    await dayCell.first().click();

    // Aparece el toast de guardado
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /seguimiento guardado/i }).first()).toBeVisible({ timeout: 8_000 });

    // Recarga y verifica que el badge "Próx:" persiste EN LA MISMA TARJETA sobre la que se
    // actuó (no en cualquier tarjeta del tablero). El layout renderiza columnas dos veces
    // (mobile oculto + desktop visible), así que se vuelve a escopar al tablero de escritorio
    // y se ubica la tarjeta por el nombre de prospecto capturado antes de abrir el editor.
    await page.reload();
    await page.waitForLoadState("networkidle");
    const desktopBoardAfterReload = page.locator("div.hidden.md\\:grid");
    const cardAfterReload = desktopBoardAfterReload.locator('div[role="button"]', { hasText: leadName });
    await expect(cardAfterReload.getByText(/Próx:/i)).toBeVisible();
  });
});

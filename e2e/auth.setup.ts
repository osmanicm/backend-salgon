import { test as setup, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const authFile = path.join(__dirname, ".auth/user.json");

const EMAIL = process.env.E2E_EMAIL ?? "inmobiliariasalgon@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

setup("authenticate", async ({ page }) => {
  if (!PASSWORD) {
    throw new Error(
      "Set E2E_PASSWORD env var to the Supabase user password before running E2E tests"
    );
  }

  await page.goto("/auth");
  await page.waitForLoadState("networkidle");

  await page.locator("#login-email").fill(EMAIL);
  await page.locator("#login-password").fill(PASSWORD);

  await page.getByRole("button", { name: /entrar/i }).click();

  // Capturar toast de error si aparece
  const toast = page.locator("[data-sonner-toast]").first();
  const toastVisible = await toast.isVisible({ timeout: 3_000 }).catch(() => false);
  if (toastVisible) {
    const msg = await toast.textContent();
    console.error(`Toast de error: ${msg}`);
  }

  await page.screenshot({ path: "test-results/auth-after-click.png" });

  await page.waitForURL((url) => !url.pathname.includes("auth"), { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});

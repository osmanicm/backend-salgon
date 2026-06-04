import { test as setup, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const authFile = path.join(__dirname, ".auth/user.json");

const EMAIL = process.env.E2E_EMAIL ?? "osmanicm@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

setup("authenticate", async ({ page }) => {
  if (!PASSWORD) {
    throw new Error(
      "Set E2E_PASSWORD env var to the Supabase user password before running E2E tests"
    );
  }

  await page.goto("/auth");

  await page.getByLabel(/correo/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();

  await expect(page).toHaveURL(/^\/((?!auth).)*$/, { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});

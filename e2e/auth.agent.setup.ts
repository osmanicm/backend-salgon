import { test as setup } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const agentAuthFile = path.join(__dirname, ".auth/agent.json");

const EMAIL = process.env.E2E_AGENT_EMAIL ?? "osmanicm@gmail.com";
const PASSWORD = process.env.E2E_AGENT_PASSWORD ?? "";

setup("authenticate agent", async ({ page }) => {
  if (!PASSWORD) {
    throw new Error(
      "Set E2E_AGENT_PASSWORD env var to the agent's Supabase password before running agent E2E tests"
    );
  }

  await page.goto("/auth");
  await page.waitForLoadState("networkidle");

  await page.locator("#login-email").fill(EMAIL);
  await page.locator("#login-password").fill(PASSWORD);

  await page.getByRole("button", { name: /entrar/i }).click();

  const toast = page.locator("[data-sonner-toast]").first();
  const toastVisible = await toast.isVisible({ timeout: 3_000 }).catch(() => false);
  if (toastVisible) {
    const msg = await toast.textContent();
    console.error(`Toast de error (agente): ${msg}`);
  }

  await page.waitForURL((url) => !url.pathname.includes("auth"), { timeout: 15_000 });

  await page.context().storageState({ path: agentAuthFile });
});

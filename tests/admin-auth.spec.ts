import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = path.join(__dirname, "fixtures", "test-vehicle.png");

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}

test.describe("Admin authentication and vehicle CRUD", () => {
  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login, create/edit/delete a vehicle, logout, then denied", async ({ page }) => {
    await loginAsAdmin(page);

    // --- Create ---
    await page.goto("/admin/vehicles");
    await page.getByRole("button", { name: "Add Vehicle" }).click();

    const slug = `e2e-test-vehicle-${Date.now()}`;
    await page.getByLabel("Slug (used in the URL)").fill(slug);
    await page.getByLabel("Make").fill("Toyota");
    await page.getByLabel("Model").fill("E2E Test Model");
    await page.getByLabel("Year").fill("2022");
    await page.getByLabel("Price (MWK)").fill("15000000");
    await page.getByLabel("Mileage (km)").fill("10000");
    await page.getByLabel("Body Type").fill("Sedan");
    await page.getByLabel("Engine").fill("2.0L");
    await page.getByLabel("Drive Type").fill("FWD");
    await page.getByLabel("Condition").fill("Used");
    await page.getByLabel("Location").fill("Lilongwe");
    await page.getByLabel("Description").fill("Created by an automated end-to-end test.");
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await expect(page.locator(".admin-image-list__item")).toHaveCount(1, { timeout: 15000 });

    await page.getByRole("button", { name: "Add Vehicle" }).click();
    await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
    const row = page.locator("tr", { hasText: "E2E Test Model" });
    await expect(row).toBeVisible();
    await expect(row.locator(".admin-badge")).toHaveText("available");

    // --- Edit: change availability status ---
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Status").selectOption("reserved");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
    const updatedRow = page.locator("tr", { hasText: "E2E Test Model" });
    await expect(updatedRow.locator(".admin-badge")).toHaveText("reserved");

    // --- Delete ---
    page.once("dialog", (dialog) => dialog.accept());
    await updatedRow.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: "E2E Test Model" })).toHaveCount(0);

    // --- Logout, then admin routes are denied ---
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin/vehicles");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

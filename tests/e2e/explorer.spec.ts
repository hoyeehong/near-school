import { test, expect } from "@playwright/test";
test("school search, selection and official-distance fail closed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find their school/ }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search schools or addresses" })
    .fill("Nanyang");
  await page.getByRole("button", { name: /^Nanyang Primary School/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nanyang Primary School" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check official distance" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Select a residential address",
  );
  await expect(page.getByText(/Portfolio demo/)).toBeVisible();
});
test("chat changes map results and undo restores previous state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Ask the map/ }).click();
  await page
    .getByRole("button", { name: "Show the two-track schools", exact: true })
    .click();
  await expect(page.getByText(/Showing 12 two-track schools/)).toBeVisible();
  await page.getByRole("button", { name: "Undo map change" }).click();
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByText("14 schools", { exact: true })).toBeVisible();
});
test("year-specific tracks and empty-state handling", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Registration exercise", { exact: true })
    .selectOption("2026");
  await page
    .getByRole("button", { name: /Discover the two-track schools/ })
    .click();
  await expect(page.getByText("No matching places")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByText("14 schools", { exact: true })).toBeVisible();
});
test("changing context prevents a delayed answer from moving the map", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({
      json: {
        answer: "Stale answer",
        actions: [{ type: "selectFeatures", ids: [] }],
        citations: [],
        mode: "demo",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: /Ask the map/ }).click();
  await page
    .getByRole("button", { name: "Show the two-track schools", exact: true })
    .click();
  await page
    .getByLabel("Registration exercise", { exact: true })
    .selectOption("2026");
  await expect(page.getByText("Stale answer")).not.toBeVisible();
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByText("14 schools", { exact: true })).toBeVisible();
});

test("map renders accessible location markers", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Map marker: Nanyang Primary School",
      exact: true,
    }),
  ).toBeAttached();
});

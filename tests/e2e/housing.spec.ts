import { test, expect } from "@playwright/test";
const home = {
  id: "ura-123456789012345678901234",
  name: "TEST GARDENS",
  address: "TEST ROAD",
  category: "home",
  quality: "official",
  coordinates: [103.81, 1.32],
  sourceUrl: "https://eservice.ura.gov.sg/maps/api/",
  updatedAt: "2026-10-04",
  housing: {
    filterSummary: "Last 12 months · resale · all property types",
    kind: "private",
    count: 8,
    medianPrice: 1800000,
    lowerPrice: 1600000,
    upperPrice: 2000000,
    medianPsf: 1800,
    medianArea: 93,
    latestMonth: "2026-09",
    firstMonth: "2026-01",
    propertyTypes: ["Condominium"],
    tenures: ["Freehold"],
    areaTypes: ["Strata"],
    saleTypes: ["resale"],
    distanceMetres: 1200,
  },
};
test("homes shortlist persists and compares recorded evidence", async ({
  page,
}) => {
  await page.route("**/api/homes?**", (r) =>
    r.fulfill({
      json: {
        homes: [home],
        total: 1,
        refreshedAt: "2026-10-04",
        sources: ["URA"],
        filters: {},
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Homes", exact: true }).click();
  await expect(page.getByText("TEST GARDENS", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Save TEST GARDENS", exact: true })
    .click();
  await page.getByRole("tab", { name: "Compare (1)", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Home comparison" }),
  ).toContainText("8 sales");
  await page.reload();
  await page.getByRole("tab", { name: "Compare (1)", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "TEST GARDENS" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove TEST GARDENS", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Find homes to compare" }),
  ).toBeVisible();
});
test("housing failure is explicit and never substituted with sample prices", async ({
  page,
}) => {
  await page.route("**/api/homes?**", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "Housing data is temporarily unavailable." },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Homes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Housing data" }),
  ).toContainText("temporarily unavailable");
  await expect(page.getByText("TEST GARDENS")).not.toBeVisible();
});

test("journey requests omit an empty walking date and clear on school changes", async ({
  page,
}) => {
  await page.addInitScript(
    (saved) =>
      localStorage.setItem("near-school-shortlist-v1", JSON.stringify([saved])),
    home,
  );
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/journey", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.mode).toBe("walk");
    expect(body.date).toBeUndefined();
    await pending;
    await route.fulfill({
      json: { mode: "walk", seconds: 600, metres: 800, transfers: 0 },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Compare (1)", exact: true }).click();
  await page.getByLabel("Compare school journeys").selectOption("nanyang");
  const request = page.waitForRequest("**/api/journey");
  await page
    .getByRole("button", { name: "Check journey", exact: true })
    .click();
  await request;
  await expect(page.getByText("Finding route…")).toBeVisible();
  await page.getByLabel("Compare school journeys").selectOption("");
  release();
  await expect(page.getByText("Finding route…")).not.toBeVisible();
  await expect(page.getByText(/10 min walk/)).not.toBeVisible();
});

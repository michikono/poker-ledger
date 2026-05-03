import { expect, test } from "@playwright/test";

test("unauthenticated visit to / lands on the sign-in page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Poker Ledger")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with Google/i }),
  ).toBeVisible();
});

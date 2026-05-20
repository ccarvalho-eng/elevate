import { expect, test } from "@playwright/test";

test("renders the sample model with preset camera controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Elevate")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Generate rough house perspectives from a blueprint.",
    }),
  ).toBeVisible();

  await expect(page.getByLabel("3D perspective viewer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Roof-off" })).toBeVisible();
  await page.getByRole("button", { name: "Exterior" }).click();
  await expect(page.getByRole("button", { name: "Exterior" })).toHaveClass(
    /active/,
  );

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 300 && rect.height > 300;
      }),
    )
    .toBe(true);
});

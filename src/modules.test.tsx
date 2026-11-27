import { beforeEach, expect, test } from "bun:test";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { api, device } from "../test/api";
import { renderAppAt } from "../test/render";

beforeEach(() => {
  api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));
});

test.each(["Weather", "Agenda", "Finance", "Rhythms"])(
  "opens the %s demo page at its own URL",
  async (title) => {
    renderAppAt(`/${title.toLowerCase()}`);

    const page = await screen.findByRole("region", { name: title });
    expect(within(page).getByLabelText("Demo content")).toBeDefined();
  },
);

test("the finance quick add saves nothing and says it is a demo", async () => {
  renderAppAt("/finance");

  const page = await screen.findByRole("region", { name: "Finance" });
  await userEvent.type(within(page).getByLabelText("Amount"), "42");
  await userEvent.click(within(page).getByRole("button", { name: "Add expense" }));

  expect(await screen.findByText("Demo only: nothing was saved.")).toBeDefined();
  expect((within(page).getByLabelText("Amount") as HTMLInputElement).value).toBe("");
});

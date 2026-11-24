import { beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Device } from "./api/generated";
import { api, device, problem } from "../test/api";
import { renderAppAt } from "../test/render";

const phone: Device = {
  id: "0193b3a0-0000-7000-8000-000000000009",
  name: "Safari on iPhone",
  user_agent: null,
  created_at: "2026-11-01T08:00:00Z",
  last_used_at: "2026-11-20T08:00:00Z",
};

beforeEach(() => {
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/devices", () =>
      HttpResponse.json([
        { ...device, current: true },
        { ...phone, current: false },
      ]),
    ),
  );
});

async function openDevices() {
  renderAppAt("/");
  await userEvent.click(await screen.findByRole("button", { name: "Connected devices" }));
  return within(await screen.findByRole("dialog", { name: "Connected devices" }));
}

test("lists every device with when it was last used", async () => {
  const dialog = await openDevices();

  const row = (await dialog.findByText(phone.name)).closest("li")!;
  expect(
    within(row)
      .getByText(/^last used /)
      .getAttribute("dateTime"),
  ).toBe(phone.last_used_at);
  expect(dialog.getByText("[This device]")).toBeDefined();
});

test("revokes another device after confirming in its row", async () => {
  const revoked: string[] = [];
  let devices = [
    { ...device, current: true },
    { ...phone, current: false },
  ];
  api.use(
    http.get("/api/devices", () => HttpResponse.json(devices)),
    http.delete("/api/devices/:id", ({ params }) => {
      revoked.push(params.id as string);
      devices = devices.filter(({ id }) => id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const dialog = await openDevices();

  await userEvent.click(await dialog.findByRole("button", { name: `Revoke ${phone.name}` }));
  const row = within(dialog.getByText(`Revoke "${phone.name}"?`).closest("li")!);
  await userEvent.click(row.getByRole("button", { name: "yes" }));

  await waitFor(() => expect(dialog.queryByText(phone.name)).toBeNull());
  expect(revoked).toEqual([phone.id]);
});

test("treats a device that is already gone as revoked", async () => {
  let devices = [
    { ...device, current: true },
    { ...phone, current: false },
  ];
  api.use(
    http.get("/api/devices", () => HttpResponse.json(devices)),
    http.delete("/api/devices/:id", () => {
      devices = devices.filter(({ id }) => id !== phone.id);
      return problem(404, "Device not found.");
    }),
  );
  const dialog = await openDevices();

  await userEvent.click(await dialog.findByRole("button", { name: `Revoke ${phone.name}` }));
  await userEvent.click(dialog.getByRole("button", { name: "yes" }));

  await waitFor(() => expect(dialog.queryByText(phone.name)).toBeNull());
  expect(dialog.queryByText("✗ Device not found.")).toBeNull();
});

test("shows a failed revoke in the device row only", async () => {
  api.use(http.delete("/api/devices/:id", () => problem(500, "The server failed.")));
  const dialog = await openDevices();

  await userEvent.click(await dialog.findByRole("button", { name: `Revoke ${phone.name}` }));
  await userEvent.click(dialog.getByRole("button", { name: "yes" }));

  const row = within((await dialog.findByText("✗ The server failed.")).closest("li")!);
  expect(row.getByText(phone.name)).toBeDefined();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getAllByText(/The server failed\./)).toHaveLength(1);
});

test("revoking this device logs the browser out", async () => {
  let active = true;
  api.use(
    http.get("/api/devices/current", () =>
      active ? HttpResponse.json(device) : problem(401, "Missing token."),
    ),
    http.delete("/api/devices/:id", ({ params }) => {
      if (params.id === device.id) active = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const dialog = await openDevices();
  expect(dialog.queryByRole("button", { name: "Forget this device" })).toBeNull();

  await userEvent.click(await dialog.findByRole("button", { name: `Revoke ${device.name}` }));
  await userEvent.click(dialog.getByRole("button", { name: "yes" }));

  expect(await screen.findByLabelText("master password")).toBeDefined();
  expect(active).toBe(false);
});

test("keeps the device when the revoke is not confirmed", async () => {
  const revoked: unknown[] = [];
  api.use(
    http.delete("/api/devices/:id", ({ params }) => {
      revoked.push(params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const dialog = await openDevices();

  await userEvent.click(await dialog.findByRole("button", { name: `Revoke ${phone.name}` }));
  await userEvent.click(dialog.getByRole("button", { name: "no" }));

  expect(dialog.getByRole("button", { name: `Revoke ${phone.name}` })).toBeDefined();
  expect(revoked).toEqual([]);
});

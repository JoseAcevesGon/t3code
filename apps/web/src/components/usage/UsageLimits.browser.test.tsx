import { ProviderDriverKind, type ServerProviderUsageWindow } from "@t3tools/contracts";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import "~/index.css";

vi.mock("../../state/session", () => ({
  useEnvironmentScope: () => true,
  readEnvironmentScope: () => true,
}));
vi.mock("../../state/server", () => ({ serverEnvironment: { consumeResetCredit: null } }));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("../../hooks/useSettings", () => ({ usePrimarySettings: () => "24h" }));

import { LimitWindows } from "./UsageLimits";

const codex = ProviderDriverKind.make("codex");
const now = Date.parse("2026-09-03T12:00:00Z");

async function render(ui: ReactNode) {
  const container = document.createElement("div");
  container.style.width = "640px";
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return {
    [Symbol.asyncDispose]: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const sessionWindow = (minutesUntilReset: number | null): ServerProviderUsageWindow => ({
  id: "five_hour",
  kind: "session",
  label: "Session",
  usedPercent: 40,
  ...(minutesUntilReset === null
    ? {}
    : {
        windowDurationMins: 300,
        resetsAt: new Date(now + minutesUntilReset * 60_000).toISOString(),
      }),
});

const tick = () => {
  const bar = page.getByRole("img", { name: /^Session:/ }).element();
  const mark = bar.querySelector(":scope > span[aria-hidden]");
  return { bar: bar.getBoundingClientRect(), mark: mark?.getBoundingClientRect() };
};

it("places the even-pace tick at the share of the window left", async () => {
  await using _screen = await render(
    <LimitWindows driver={codex} windows={[sessionWindow(90)]} now={now} />,
  );
  const { bar, mark } = tick();
  expect(mark).toBeDefined();
  expect(mark!.left + mark!.width / 2 - bar.left).toBeCloseTo(bar.width * 0.3, 0);
});

it("keeps the tick inside the bar at both ends of the window", async () => {
  for (const minutesUntilReset of [0, 300]) {
    await using _screen = await render(
      <LimitWindows driver={codex} windows={[sessionWindow(minutesUntilReset)]} now={now} />,
    );
    const { bar, mark } = tick();
    expect(mark!.left).toBeGreaterThanOrEqual(bar.left);
    expect(mark!.right).toBeLessThanOrEqual(bar.right);
  }
});

it("shows no tick when the window timing is unknown", async () => {
  await using _screen = await render(
    <LimitWindows driver={codex} windows={[sessionWindow(null)]} now={now} />,
  );
  expect(tick().mark).toBeUndefined();
});

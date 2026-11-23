const BROWSERS: [name: string, marker: RegExp][] = [
  ["Edge", /Edg\//],
  ["Firefox", /Firefox\//],
  ["Chrome", /Chrome\//],
  ["Safari", /Safari\//],
];

const SYSTEMS: [name: string, marker: RegExp][] = [
  ["Android", /Android/],
  ["iOS", /iPhone|iPad/],
  ["Windows", /Windows/],
  ["macOS", /Macintosh/],
  ["Linux", /Linux/],
];

function firstMatch(userAgent: string, candidates: [string, RegExp][]): string | undefined {
  return candidates.find(([, marker]) => marker.test(userAgent))?.[0];
}

export function deviceName(userAgent: string): string {
  const browser = firstMatch(userAgent, BROWSERS);
  if (!browser) return "Web browser";

  const system = firstMatch(userAgent, SYSTEMS);
  return system ? `${browser} on ${system}` : browser;
}

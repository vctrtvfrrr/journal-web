export type Decision =
  | { action: "release"; version: string; ignored: string[] }
  | { action: "skip"; ignored: string[] }
  | { action: "reject"; problem: string };

type Version = [major: number, minor: number, patch: number];
type Bump = "breaking" | "minor" | "patch";

const BUMPS: Bump[] = ["breaking", "minor", "patch"];

const FIRST_VERSION = "0.1.0";
const CONVENTIONAL_SUBJECT = /^([a-z]+)(?:\([^)]*\))?(!)?: \S/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const RELEASE_AS_FOOTER = /^Release-As:[ \t]*(\S+)\s*$/m;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function decideRelease(latestVersion: string | undefined, messages: string[]): Decision {
  if (latestVersion === undefined)
    return { action: "release", version: FIRST_VERSION, ignored: [] };

  const ignored = messages.filter((message) => !CONVENTIONAL_SUBJECT.test(message)).map(subjectOf);
  const requested = messages.flatMap((message) => RELEASE_AS_FOOTER.exec(message)?.[1] ?? []);
  const malformed = requested.find((version) => !VERSION.test(version));
  if (malformed)
    return {
      action: "reject",
      problem: `Release-As ${malformed} must be a MAJOR.MINOR.PATCH version.`,
    };
  const [releaseAs] = requested.map(parseVersion).sort(compareVersions).reverse();
  if (releaseAs) {
    const latest = parseVersion(latestVersion);
    if (compareVersions(releaseAs, latest) <= 0) {
      return {
        action: "reject",
        problem: `Release-As ${formatVersion(releaseAs)} must be greater than the latest release ${latestVersion}.`,
      };
    }
    return { action: "release", version: formatVersion(releaseAs), ignored };
  }

  const bumps = messages.map(bumpOf);
  const bump = BUMPS.find((candidate) => bumps.includes(candidate));
  if (!bump) return { action: "skip", ignored };
  return {
    action: "release",
    version: formatVersion(bumped(parseVersion(latestVersion), bump)),
    ignored,
  };
}

function bumpOf(message: string): Bump | undefined {
  const match = CONVENTIONAL_SUBJECT.exec(message);
  if (!match) return undefined;
  if (match[2] || BREAKING_FOOTER.test(message)) return "breaking";
  if (match[1] === "feat") return "minor";
  if (match[1] === "fix" || match[1] === "perf") return "patch";
}

export function subjectOf(message: string): string {
  return message.split("\n", 1)[0]!;
}

function bumped([major, minor, patch]: Version, bump: Bump): Version {
  if (bump === "breaking" && major >= 1) return [major + 1, 0, 0];
  if (bump === "patch") return [major, minor, patch + 1];
  return [major, minor + 1, 0];
}

function parseVersion(text: string): Version {
  const match = VERSION.exec(text);
  if (!match) throw new Error(`Invalid version: ${text}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a: Version, b: Version): number {
  return a.map((part, index) => part - b[index]!).find((difference) => difference !== 0) ?? 0;
}

function formatVersion(version: Version): string {
  return version.join(".");
}

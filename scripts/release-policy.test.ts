import { describe, expect, it } from "bun:test";
import { decideRelease } from "./release-policy";

describe("decideRelease", () => {
  it("releases 0.1.0 when nothing was released yet", () => {
    expect(decideRelease(undefined, ["chore: start"])).toEqual({
      action: "release",
      version: "0.1.0",
      ignored: [],
    });
  });

  it("releases a minor version for a feature", () => {
    expect(decideRelease("0.4.2", ["fix: a", "feat: b"])).toEqual({
      action: "release",
      version: "0.5.0",
      ignored: [],
    });
  });

  it("releases a patch version for a fix or a performance improvement", () => {
    expect(decideRelease("0.4.2", ["perf: a", "fix(tasks): b"])).toMatchObject({
      version: "0.4.3",
    });
  });

  it("skips the release when no commit changes behavior", () => {
    const messages = [
      "refactor: a",
      "test: b",
      "docs: c",
      "ci: d",
      "style: e",
      "chore: f",
      "build: g",
    ];
    expect(decideRelease("0.4.2", messages)).toEqual({ action: "skip", ignored: [] });
  });

  it("releases a breaking change in 0.x as a minor version", () => {
    expect(decideRelease("0.4.2", ["refactor!: a"])).toMatchObject({ version: "0.5.0" });
  });

  it("releases a breaking change from 1.0.0 on as a major version", () => {
    expect(decideRelease("1.4.2", ["fix: a", "feat(notes)!: b"])).toMatchObject({
      version: "2.0.0",
    });
  });

  it("recognizes a breaking change from the BREAKING CHANGE footer", () => {
    const message = "fix: a\n\nBody.\n\nBREAKING CHANGE: clients must resend the token.";
    expect(decideRelease("1.4.2", [message])).toMatchObject({ version: "2.0.0" });
  });

  it("ignores and reports commits that do not follow Conventional Commits", () => {
    const messages = ["ajusta cors\n\nfeat: not a subject", "Feat: a", "fix: b"];
    expect(decideRelease("0.4.2", messages)).toEqual({
      action: "release",
      version: "0.4.3",
      ignored: ["ajusta cors", "Feat: a"],
    });
  });

  it("releases the version a Release-As footer asks for", () => {
    const messages = ["feat!: a", "chore: mark the first published client\n\nRelease-As: 1.0.0"];
    expect(decideRelease("0.9.3", messages)).toMatchObject({ action: "release", version: "1.0.0" });
  });

  it("rejects a Release-As version that is not greater than the latest release", () => {
    expect(decideRelease("0.9.3", ["chore: a\n\nRelease-As: 0.9.3"])).toEqual({
      action: "reject",
      problem: "Release-As 0.9.3 must be greater than the latest release 0.9.3.",
    });
  });

  it("honors a Release-As footer with trailing whitespace", () => {
    expect(decideRelease("0.9.3", ["chore: a\r\n\r\nRelease-As: 1.0.0 \r\n"])).toMatchObject({
      version: "1.0.0",
    });
  });

  it("rejects a Release-As value that is not a version", () => {
    expect(decideRelease("0.9.3", ["chore: a\n\nRelease-As: 1.0"])).toEqual({
      action: "reject",
      problem: "Release-As 1.0 must be a MAJOR.MINOR.PATCH version.",
    });
  });

  it("reports ignored commits when it skips the release", () => {
    expect(decideRelease("1.4.2", ["wip", "docs: a"])).toEqual({
      action: "skip",
      ignored: ["wip"],
    });
  });

  it("releases a feature from 1.0.0 on as a minor version", () => {
    expect(decideRelease("1.4.2", ["feat: a"])).toMatchObject({ version: "1.5.0" });
  });
});

import { appendFile } from "node:fs/promises";
import { $ } from "bun";
import { contractVersion } from "../src/api/contract-version";
import { decideRelease, subjectOf } from "./release-policy";

const COMMIT_SEPARATOR = "\x00";
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

async function latestTag(): Promise<string | undefined> {
  const tags = await $`git tag --list ${"v*"} --merged HEAD --sort=-v:refname`.text();
  return tags.split("\n").find((tag) => RELEASE_TAG.test(tag));
}

async function commitMessagesSince(tag: string | undefined): Promise<string[]> {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const log = await $`git log --format=%B%x00 ${range}`.text();
  return log
    .split(COMMIT_SEPARATOR)
    .map((message) => message.trim())
    .filter(Boolean);
}

async function setOutput(name: string, value: string): Promise<void> {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function writeNotes(notes: string): Promise<void> {
  if (process.env.RELEASE_NOTES) await Bun.write(process.env.RELEASE_NOTES, notes);
}

function releaseNotes(tag: string | undefined, messages: string[]): string {
  const changes = tag ? messages.map((message) => `- ${subjectOf(message)}`) : ["First release."];
  return [`Uses contract v${contractVersion()}.`, "", ...changes, ""].join("\n");
}

const tag = await latestTag();
const messages = await commitMessagesSince(tag);
const decision = decideRelease(tag?.slice(1), messages);

if (decision.action === "reject") {
  console.error(decision.problem);
  process.exit(1);
}

for (const subject of decision.ignored) {
  console.warn(`Ignored a commit that does not follow Conventional Commits: ${subject}`);
}

await setOutput("release", String(decision.action === "release"));
if (decision.action === "skip") {
  console.log(`No commit since ${tag} asks for a release.`);
} else {
  await setOutput("version", decision.version);
  await writeNotes(releaseNotes(tag, messages));
  console.log(`Release v${decision.version}${tag ? ` (from ${tag})` : ""}.`);
}

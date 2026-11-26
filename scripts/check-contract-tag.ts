import { $ } from "bun";
import { contractVersion } from "../src/api/contract-version";

const expected = `v${contractVersion()}`;
const tags = (await $`git -C spec tag --points-at HEAD`.text()).split("\n").filter(Boolean);

if (!tags.includes(expected)) {
  const found = tags.length > 0 ? tags.join(", ") : "no tag";
  console.error(
    `The spec submodule must be checked out at ${expected}, but its commit has ${found}.`,
  );
  process.exit(1);
}
console.log(`The spec submodule is at ${expected}.`);

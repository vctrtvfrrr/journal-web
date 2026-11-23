import { $ } from "bun";
import { CONTRACT_PATH, contractVersion, downloadContract, isReleaseTag } from "./contract";

const ref = Bun.argv[2];
if (!ref) {
  console.error("Usage: bun run contract:pull <tag | branch | commit>");
  process.exit(1);
}

const contract = await downloadContract(ref);
const version = contractVersion(contract);

if (isReleaseTag(ref) && ref !== `v${version}`) {
  console.error(`Tag ${ref} holds a contract with info.version ${version}.`);
  process.exit(1);
}
if (!isReleaseTag(ref)) {
  console.warn(
    `${ref} is not a release tag: CI rejects this contract until the API publishes v${version}.`,
  );
}

await Bun.write(CONTRACT_PATH, contract);
await $`bun run gen`;
console.log(`Contract ${version} pulled from ${ref}.`);

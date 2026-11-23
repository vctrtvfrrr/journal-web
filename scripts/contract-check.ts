import { CONTRACT_PATH, contractVersion, downloadContract } from "./contract";

const committed = await Bun.file(CONTRACT_PATH).text();
const tag = `v${contractVersion(committed)}`;
const released = await downloadContract(tag);

if (committed !== released) {
  console.error(
    `${CONTRACT_PATH} differs from the contract published at ${tag}. Run: bun run contract:pull ${tag}`,
  );
  process.exit(1);
}
console.log(`${CONTRACT_PATH} matches the contract published at ${tag}.`);

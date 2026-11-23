export const CONTRACT_PATH = "contract/openapi.json";

const GITEA_URL = "https://git.codelab.tec.br";
const API_REPOSITORY = "vctrtvfrrr/journal-api";

export async function downloadContract(ref: string): Promise<string> {
  const token = Bun.env.API_CONTRACT_TOKEN;
  if (!token) throw new Error("Set API_CONTRACT_TOKEN to a read-only Gitea token.");

  const url = `${GITEA_URL}/api/v1/repos/${API_REPOSITORY}/raw/docs/openapi.json?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: { authorization: `token ${token}` } });
  if (!response.ok)
    throw new Error(`Could not download the contract at ${ref}: HTTP ${response.status}.`);
  return response.text();
}

export function contractVersion(contract: string): string {
  const version = JSON.parse(contract)?.info?.version;
  if (typeof version !== "string") throw new Error("The contract has no info.version.");
  return version;
}

export function isReleaseTag(ref: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(ref);
}

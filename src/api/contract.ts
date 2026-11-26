import { contractVersion } from "./contract-version" with { type: "macro" };
import { client } from "./generated/client.gen";
import { zContractVersionProblem } from "./generated/zod.gen";

export const CONTRACT_VERSION = contractVersion();

client.setConfig({ headers: { "Contract-Version": CONTRACT_VERSION } });

async function minimumVersionIfUnsupported(response: Response): Promise<string | undefined> {
  if (response.status !== 400) return undefined;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined);
  const problem = zContractVersionProblem.safeParse(body);
  return problem.success ? problem.data.minimum_version : undefined;
}

export function onUnsupportedContract(listener: (minimumVersion: string) => void) {
  const id = client.interceptors.response.use(async (response) => {
    const minimumVersion = await minimumVersionIfUnsupported(response);
    if (minimumVersion) listener(minimumVersion);
    return response;
  });
  return () => client.interceptors.response.eject(id);
}

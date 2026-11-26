import { contractVersion } from "./contract-version" with { type: "macro" };
import { client } from "./generated/client.gen";

export const CONTRACT_VERSION = contractVersion();

client.setConfig({ headers: { "Contract-Version": CONTRACT_VERSION } });

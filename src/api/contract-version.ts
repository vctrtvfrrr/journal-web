import contract from "../../spec/openapi.yaml";

export function contractVersion(): string {
  return contract.info.version;
}

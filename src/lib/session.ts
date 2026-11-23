import type { QueryClient } from "@tanstack/react-query";
import { getCurrentDeviceOptions } from "../api/generated/@tanstack/react-query.gen";
import { isUnauthorized } from "./problem";

export const currentDeviceQuery = { ...getCurrentDeviceOptions(), meta: { handledByRoute: true } };

export async function hasSession(queryClient: QueryClient): Promise<boolean> {
  try {
    await queryClient.ensureQueryData(currentDeviceQuery);
    return true;
  } catch (error) {
    if (isUnauthorized(error)) return false;
    throw error;
  }
}

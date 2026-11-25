import { ZodError } from "zod";
import type { FieldError, Problem, ValidationProblem } from "../api/generated";

export function isProblem(error: unknown): error is Problem {
  return typeof error === "object" && error !== null && "status" in error && "detail" in error;
}

export function isUnauthorized(error: unknown): boolean {
  return isProblem(error) && error.status === 401;
}

export function describeError(error: unknown): string {
  if (error instanceof ZodError)
    return "The API answered in a format this app does not know. Update the app.";
  if (isProblem(error)) return error.detail;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function fieldErrors(problem: Problem | ValidationProblem): FieldError[] {
  return "errors" in problem ? problem.errors : [];
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (!isProblem(error)) return undefined;
  return fieldErrors(error).find(({ pointer }) => pointerField(pointer) === field)?.detail;
}

export function pointerField(pointer: string): string {
  return pointer.replace(/^#\//, "");
}

export function waitTime(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

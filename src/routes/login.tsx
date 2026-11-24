import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { login } from "../api/generated";
import { zLoginInput } from "../api/generated/zod.gen";
import { ErrorText, Field } from "../components/field";
import { JournalShell } from "../components/journal-shell";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { deviceName } from "../lib/device-name";
import { describeError, fieldErrors, isProblem, pointerField, waitTime } from "../lib/problem";
import { currentDeviceQuery } from "../lib/session";

const loginForm = zLoginInput.pick({ password: true });

export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof loginForm>>({
    resolver: zodResolver(loginForm),
    defaultValues: { password: "" },
  });

  const [formErrors, setFormErrors] = useState<string[]>([]);

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormErrors([]);
    const { data, error, response } = await login({
      body: { password, name: deviceName(navigator.userAgent), token_delivery: "cookie" },
    });
    if (data) {
      queryClient.setQueryData(currentDeviceQuery.queryKey, data);
      await navigate({ to: "/" });
      return;
    }

    if (!response) {
      setFormErrors(["Could not reach the API."]);
    } else if (!isProblem(error)) {
      setFormErrors([describeError(error)]);
    } else if (response.status === 401) {
      form.setError("password", { message: error.detail });
    } else if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0 ? `in ${waitTime(retryAfter)}` : "later";
      setFormErrors([`Too many failed logins. Try again ${wait}.`]);
    } else {
      const invalidFields = fieldErrors(error);
      if (invalidFields.length === 0) {
        setFormErrors([error.detail]);
        return;
      }
      const errorsWithoutField: string[] = [];
      for (const { pointer, detail } of invalidFields) {
        const field = pointerField(pointer);
        if (field === "password") form.setError("password", { message: detail });
        else errorsWithoutField.push(`${field}: ${detail}`);
      }
      setFormErrors(errorsWithoutField);
    }
  });

  return (
    <JournalShell status={<span className="text-muted-foreground">Locked</span>}>
      <form onSubmit={onSubmit} noValidate className="mx-auto mt-2 w-full max-w-sm">
        <Card
          label={
            <span role="heading" aria-level={1}>
              Unlock Journal
            </span>
          }
        >
          <CardContent className="grid gap-4">
            <Field
              label="master password"
              htmlFor="password"
              error={form.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
            </Field>
            {formErrors.map((message) => (
              <ErrorText key={message}>{message}</ErrorText>
            ))}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              log in
            </Button>
          </CardFooter>
        </Card>
      </form>
    </JournalShell>
  );
}

"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, PasswordInput, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { errorCode, errorMessage, mgpl } from "@/lib/mgpl";

const schema = z
  .object({ password: z.string().min(10, "Use at least 10 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords differ", path: ["confirm"] });

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [error, setError] = useState<string | null>(token ? null : "This link is missing its token. Open the link from the email again");
  const form = useForm({ initialValues: { password: "", confirm: "" }, validate: zod4Resolver(schema) });
  return (
    <Card>
      <form
        onSubmit={form.onSubmit(async (v) => {
          setError(null);
          try {
            await mgpl.auth.resetPassword(token, v.password);
            notifications.show({ color: "tulsi", title: "Password changed", message: "Sign in with the new password" });
            router.replace("/login");
          } catch (err) {
            const code = errorCode(err);
            setError(code === "INVALID_TOKEN" ? "This link was used or has expired. Ask for a new one from the sign-in page" : code === "WEAK_PASSWORD" ? errorMessage(err) : errorMessage(err));
          }
        })}
      >
        <Stack>
          <Title order={1} fz={24}>Set a new password</Title>
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <PasswordInput label="New password" autoComplete="new-password" {...form.getInputProps("password")} />
          <PasswordInput label="Type it again" autoComplete="new-password" {...form.getInputProps("confirm")} />
          <Button type="submit" disabled={!token} loading={form.submitting}>Save password</Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

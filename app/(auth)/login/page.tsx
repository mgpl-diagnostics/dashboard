"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Anchor, Button, Card, Group, Modal, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { errorCode, errorMessage, mgpl } from "@/lib/mgpl";

const schema = z.object({
  orgCode: z.string().trim().max(32),
  email: z.email("Enter the email you sign in with"),
  password: z.string().min(1, "Enter your password"),
});

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don't match. Check both and try again",
  ACCOUNT_DISABLED: "This account is switched off. Ask your admin to turn it back on",
  INVITE_PENDING: "This account hasn't been set up yet. Use the link in your invite email",
  ORG_REQUIRED: "This email is in more than one lab. Enter the code of the lab you want to sign in to",
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // The api finds the lab from the account itself. The code is asked for only when one email
  // belongs to several labs (ORG_REQUIRED); a deployment can also preset it.
  const [needOrg, setNeedOrg] = useState(false);
  const [resetOpen, reset] = useDisclosure(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { orgCode: process.env.NEXT_PUBLIC_MGPL_ORG_CODE ?? "", email: "", password: "" },
    validate: zod4Resolver(schema),
  });

  const submit = form.onSubmit(async (v) => {
    setError(null);
    try {
      await mgpl.auth.login({ email: v.email.trim(), password: v.password, orgCode: v.orgCode.trim() || undefined });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      const code = errorCode(err);
      if (code === "ORG_REQUIRED") setNeedOrg(true);
      setError((code && MESSAGES[code]) || errorMessage(err));
    }
  });

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          <Title order={1} fz={24}>Sign in</Title>
          {error && (
            <Alert color="red" variant="light" icon={<WarningCircleIcon size={18} />} role="alert">
              {error}
            </Alert>
          )}
          {needOrg && (
            <TextInput label="Lab code" autoComplete="organization" {...form.getInputProps("orgCode")} key={form.key("orgCode")} />
          )}
          <TextInput label="Email" type="email" autoComplete="username" inputMode="email" required {...form.getInputProps("email")} key={form.key("email")} />
          <PasswordInput label="Password" autoComplete="current-password" required {...form.getInputProps("password")} key={form.key("password")} />
          <Button type="submit" size="md" loading={form.submitting}>Sign in</Button>
          <Group justify="flex-end">
            <Anchor component="button" type="button" size="sm" onClick={reset.open}>Forgot password</Anchor>
          </Group>
        </Stack>
      </form>
      <ForgotPassword opened={resetOpen} onClose={reset.close} orgCode={form.getValues().orgCode} />
    </Card>
  );
}

function ForgotPassword({ opened, onClose, orgCode }: { opened: boolean; onClose: () => void; orgCode: string }) {
  const form = useForm({ initialValues: { email: "" }, validate: zod4Resolver(z.object({ email: z.email("Enter your email") })) });
  return (
    <Modal opened={opened} onClose={onClose} title="Reset your password">
      <form
        onSubmit={form.onSubmit(async ({ email }) => {
          try {
            await mgpl.auth.requestPasswordReset(email.trim(), orgCode.trim() || undefined);
          } catch {
            /* the api never reveals whether an email exists; neither do we */
          }
          notifications.show({ color: "tulsi", title: "Check your email", message: "If that email has an account, a reset link is on its way" });
          onClose();
        })}
      >
        <Stack>
          <Text size="sm" c="dimmed">We&apos;ll email a single-use link to set a new password.</Text>
          <TextInput label="Email" type="email" autoComplete="username" data-autofocus {...form.getInputProps("email")} />
          <Button type="submit" loading={form.submitting}>Send link</Button>
        </Stack>
      </form>
    </Modal>
  );
}

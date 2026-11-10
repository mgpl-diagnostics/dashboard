"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Anchor, Button, Card, Group, Modal, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { CaretRightIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { labChoices } from "@/lib/labs";
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
  ORG_UNAVAILABLE: "That lab is no longer available to you. Pick another",
};

/**
 * Where to go after signing in: a path on this origin, never another site. A prefix check is not
 * enough: browsers drop tabs and newlines and read "\" as "/", so "/\tevil.example" or "/\evil.example"
 * pass `startsWith("/") && !startsWith("//")` and still leave the site. Resolve it, then compare origins.
 */
function safeNext(next: string | null): string {
  if (!next) return "/";
  try {
    const url = new URL(next, window.location.origin);
    // "//host" as a path would be read as another site again when it is navigated to
    if (url.origin !== window.location.origin || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // The api finds the lab from the account itself. The code is asked for only when one email
  // belongs to several labs (ORG_REQUIRED); a deployment can also preset it.
  const [needOrg, setNeedOrg] = useState(false);
  // …or, when the api names them, the labs to pick from (only labs whose account matched the password)
  const [labs, setLabs] = useState<{ code: string; name: string }[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [resetOpen, reset] = useDisclosure(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { orgCode: process.env.NEXT_PUBLIC_MGPL_ORG_CODE ?? "", email: "", password: "" },
    validate: zod4Resolver(schema),
  });

  async function signIn(v: { email: string; password: string; orgCode: string }) {
    setError(null);
    try {
      await mgpl.auth.login({ email: v.email.trim(), password: v.password, orgCode: v.orgCode.trim() || undefined });
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      const code = errorCode(err);
      if (code === "ORG_REQUIRED") {
        const choices = labChoices(err);
        setLabs(choices);
        if (choices.length) return; // the pick list says it all
        setNeedOrg(true);
      }
      setError((code && MESSAGES[code]) || errorMessage(err));
    }
  }
  const submit = form.onSubmit(signIn);

  async function pick(code: string) {
    setPicking(code);
    await signIn({ ...form.getValues(), orgCode: code });
    setPicking(null);
  }

  if (labs.length) {
    return (
      <Card>
        <Stack gap="md">
          <div>
            <Title order={1} fz={24}>Choose a lab</Title>
            <Text size="sm" c="dimmed" mt={4}>{form.getValues().email.trim()} works at more than one lab. You can switch later from the account menu.</Text>
          </div>
          {error && (
            <Alert color="red" variant="light" icon={<WarningCircleIcon size={18} />} role="alert">
              {error}
            </Alert>
          )}
          <Stack gap="xs">
            {labs.map((l) => (
              <Button
                key={l.code}
                variant="default"
                size="lg"
                justify="space-between"
                fullWidth
                rightSection={<CaretRightIcon size={16} />}
                loading={picking === l.code}
                disabled={!!picking && picking !== l.code}
                onClick={() => pick(l.code)}
              >
                <Stack gap={0} align="flex-start">
                  <Text size="sm" fw={500} lh={1.3}>{l.name}</Text>
                  <Text size="xs" c="dimmed" lh={1.3}>{l.code}</Text>
                </Stack>
              </Button>
            ))}
          </Stack>
          <Group justify="flex-start">
            <Anchor component="button" type="button" size="sm" onClick={() => { setLabs([]); setError(null); }}>Use another account</Anchor>
          </Group>
        </Stack>
      </Card>
    );
  }

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

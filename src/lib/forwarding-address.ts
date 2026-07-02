import { getPreferenceValues } from "@raycast/api";
import { DdgApiError } from "./errors";
import { getActiveAccount } from "./storage";
import { normalizeUsername } from "./validation";

const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function extractEmail(value: string) {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^<>]+)>/);
  const email = angleMatch?.[1] ?? trimmed;

  return email
    .replace(/^mailto:/i, "")
    .split("?")[0]
    .trim();
}

export function normalizeRecipientEmail(value: string) {
  const email = extractEmail(value);

  if (!email) {
    throw new DdgApiError(
      "Invalid Recipient Email",
      "Enter the email address you want to send to.",
    );
  }

  if (!EMAIL_REGEX.test(email) || email.split("@").length !== 2) {
    throw new DdgApiError(
      "Invalid Recipient Email",
      "Enter a valid recipient email address.",
    );
  }

  return email;
}

export function createForwardingAddress(
  recipientEmail: string,
  duckAddress: string,
) {
  const normalizedRecipient = normalizeRecipientEmail(recipientEmail);
  const duckUsername = normalizeUsername(duckAddress);
  const recipientForDuck = normalizedRecipient.replace("@", "_at_");

  return `${recipientForDuck}_${duckUsername}@duck.com`;
}

export async function getDefaultDuckUsername() {
  const preferences = getPreferenceValues<Preferences>();
  const activeAccount = await getActiveAccount();

  return activeAccount?.username || preferences.duckAddress || "";
}

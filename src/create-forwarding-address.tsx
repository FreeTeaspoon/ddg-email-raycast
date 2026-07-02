import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { getToastOptions } from "./lib/errors";
import {
  createForwardingAddress,
  getDefaultDuckUsername,
  normalizeRecipientEmail,
} from "./lib/forwarding-address";

type ForwardingFormValues = {
  recipientEmail: string;
  duckAddress: string;
};

export default function Command() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [duckAddress, setDuckAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDefaults() {
      try {
        const [clipboardText, defaultDuckUsername] = await Promise.all([
          Clipboard.readText(),
          getDefaultDuckUsername(),
        ]);

        if (clipboardText) {
          try {
            setRecipientEmail(normalizeRecipientEmail(clipboardText));
          } catch {
            setRecipientEmail("");
          }
        }

        setDuckAddress(defaultDuckUsername);
      } finally {
        setIsLoading(false);
      }
    }

    loadDefaults();
  }, []);

  async function handleSubmit(values: ForwardingFormValues) {
    setIsLoading(true);

    try {
      const forwardingAddress = createForwardingAddress(
        values.recipientEmail,
        values.duckAddress,
      );
      await Clipboard.copy(forwardingAddress);
      await showToast({
        style: Toast.Style.Success,
        title: "Forwarding Address Copied",
        message: forwardingAddress,
      });
    } catch (error) {
      await showToast(getToastOptions(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create and Copy Forwarding Address"
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="recipientEmail"
        title="Recipient Email"
        placeholder="brian@gmail.com"
        value={recipientEmail}
        onChange={setRecipientEmail}
        info="The address you want to email from your Duck address."
      />
      <Form.TextField
        id="duckAddress"
        title="Your Duck Address"
        placeholder="jane"
        value={duckAddress}
        onChange={setDuckAddress}
        info="Your personal Duck address, with or without @duck.com."
      />
    </Form>
  );
}

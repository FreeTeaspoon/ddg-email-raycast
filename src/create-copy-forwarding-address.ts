import {
  Clipboard,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import {
  createForwardingAddress,
  getDefaultDuckUsername,
} from "./lib/forwarding-address";

async function launchForwardingForm() {
  await launchCommand({
    name: "create-forwarding-address",
    type: LaunchType.UserInitiated,
  });
}

export default async function Command() {
  const [clipboardText, duckAddress] = await Promise.all([
    Clipboard.readText(),
    getDefaultDuckUsername(),
  ]);

  try {
    const forwardingAddress = createForwardingAddress(
      clipboardText ?? "",
      duckAddress,
    );
    await Clipboard.copy(forwardingAddress);
    await showToast({
      style: Toast.Style.Success,
      title: "Forwarding Address Copied",
      message: forwardingAddress,
    });
  } catch {
    await showToast({
      style: Toast.Style.Failure,
      title: "Enter Forwarding Details",
      message: "Opening the form so you can enter the missing details.",
    });
    await launchForwardingForm();
  }
}

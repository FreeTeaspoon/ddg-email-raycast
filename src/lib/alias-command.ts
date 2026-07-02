import {
  Clipboard,
  getPreferenceValues,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import { generateAddress } from "./ddg-api";
import { getToastOptions } from "./errors";
import {
  getAccountStore,
  PREFERENCE_ACCOUNT_ID,
  saveRecentAlias,
} from "./storage";

export async function getSavedTokenContext() {
  const preferences = getPreferenceValues<Preferences>();
  const accountStore = await getAccountStore();
  const activeAccount = accountStore.accounts.find(
    (account) => account.id === accountStore.activeAccountId,
  );

  if (activeAccount) {
    return {
      accessToken: activeAccount.accessToken,
      accountId: activeAccount.id,
    };
  }

  if (accountStore.accounts.length === 0 && preferences.accessToken) {
    return {
      accessToken: preferences.accessToken,
      accountId: PREFERENCE_ACCOUNT_ID,
    };
  }

  return undefined;
}

export async function generateCopyAndStoreAlias(
  accessToken: string,
  accountId: string,
) {
  const generated = await generateAddress(accessToken);
  await Clipboard.copy(generated.fullAddress);
  await saveRecentAlias(accountId, generated);

  return generated;
}

export async function launchSetupCommand() {
  await launchCommand({
    name: "generate-alias",
    type: LaunchType.UserInitiated,
  });
}

export async function generateAliasFromSavedToken() {
  const tokenContext = await getSavedTokenContext();

  if (!tokenContext) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No Access Token",
      message: "Open setup or add an access token in extension preferences.",
      primaryAction: {
        title: "Open Setup",
        onAction: launchSetupCommand,
      },
    });
    return;
  }

  try {
    await showToast({
      style: Toast.Style.Animated,
      title: "Generating Alias",
    });
    const generated = await generateCopyAndStoreAlias(
      tokenContext.accessToken,
      tokenContext.accountId,
    );
    await showToast({
      style: Toast.Style.Success,
      title: "Alias Copied",
      message: generated.fullAddress,
    });
  } catch (error) {
    await showToast(getToastOptions(error));
  }
}

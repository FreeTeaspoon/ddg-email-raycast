import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  confirmAlert,
  getPreferenceValues,
  Icon,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { RecentAliases } from "./components/RecentAliases";
import { SetupForm } from "./components/SetupForm";
import { generateAddress, getDashboard, loginWithOtp } from "./lib/ddg-api";
import { getToastOptions, isDdgApiError } from "./lib/errors";
import {
  clearStoredAccounts,
  clearRecentAliases,
  getAccountStore,
  getRecentAliases,
  PREFERENCE_ACCOUNT_ID,
  removeStoredAccount,
  saveRecentAlias,
  setActiveAccount,
  upsertStoredAccount,
} from "./lib/storage";
import type { AccountStore, RecentAlias, StoredAccount } from "./types/ddg";

type SetupFormValues = {
  username: string;
  otp: string;
};

function getAccountTitle(account: StoredAccount) {
  return account.label || account.username || account.email || "Duck Account";
}

function getAccountSubtitle(account: StoredAccount) {
  if (account.email && account.username) {
    return `${account.username} · ${account.email}`;
  }

  return account.email || account.username || "Stored Duck account";
}

function getActiveAccount(accountStore: AccountStore) {
  return accountStore.accounts.find(
    (account) => account.id === accountStore.activeAccountId,
  );
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [accountStore, setAccountStore] = useState<AccountStore>({
    accounts: [],
  });
  const [recentAliases, setRecentAliases] = useState<RecentAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const activeAccount = useMemo(
    () => getActiveAccount(accountStore),
    [accountStore],
  );
  const accessToken =
    activeAccount?.accessToken ||
    (accountStore.accounts.length === 0 ? preferences.accessToken : undefined);
  const recentAliasAccountId = activeAccount?.id ?? PREFERENCE_ACCOUNT_ID;

  useEffect(() => {
    async function loadState() {
      try {
        const store = await getAccountStore();
        const activeStoredAccount = getActiveAccount(store);
        const historyAccountId =
          activeStoredAccount?.id ?? PREFERENCE_ACCOUNT_ID;
        const aliases = await getRecentAliases(historyAccountId);

        setAccountStore(store);
        setRecentAliases(aliases);
      } finally {
        setIsLoading(false);
      }
    }

    loadState();
  }, []);

  async function reloadRecentAliases(accountId: string) {
    setRecentAliases(await getRecentAliases(accountId));
  }

  async function handleSetActiveAccount(accountId: string) {
    const nextStore = await setActiveAccount(accountId);
    const nextActiveAccount = getActiveAccount(nextStore);

    setAccountStore(nextStore);
    await reloadRecentAliases(nextActiveAccount?.id ?? PREFERENCE_ACCOUNT_ID);
    await showToast({
      style: Toast.Style.Success,
      title: "Active Account Changed",
      message: nextActiveAccount
        ? getAccountTitle(nextActiveAccount)
        : undefined,
    });
  }

  async function handleClearRecentAliases() {
    const confirmed = await confirmAlert({
      title: "Clear Recent Aliases?",
      message: "This clears recent aliases for the active account only.",
      primaryAction: {
        title: "Clear",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    await clearRecentAliases(recentAliasAccountId);
    setRecentAliases([]);
    await showToast({
      style: Toast.Style.Success,
      title: "Recent Aliases Cleared",
    });
  }

  async function handleRemoveActiveAccount() {
    if (!activeAccount) {
      return;
    }

    const confirmed = await confirmAlert({
      title: "Remove Active Account?",
      message: `${getAccountTitle(activeAccount)} will be removed from this extension.`,
      primaryAction: {
        title: "Remove",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    const nextStore = await removeStoredAccount(activeAccount.id);
    const nextActiveAccount = getActiveAccount(nextStore);

    setAccountStore(nextStore);
    await reloadRecentAliases(nextActiveAccount?.id ?? PREFERENCE_ACCOUNT_ID);
    await showToast({
      style: Toast.Style.Success,
      title: "Account Removed",
      message: nextActiveAccount
        ? `${getAccountTitle(nextActiveAccount)} is now active.`
        : undefined,
    });
  }

  async function handleClearAccounts() {
    const confirmed = await confirmAlert({
      title: "Clear All Accounts?",
      message: "All stored Duck accounts will be removed from this extension.",
      primaryAction: {
        title: "Clear Accounts",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    await clearStoredAccounts();
    setAccountStore({ accounts: [] });
    await reloadRecentAliases(PREFERENCE_ACCOUNT_ID);
    await showToast({
      style: Toast.Style.Success,
      title: "Stored Accounts Cleared",
    });
  }

  async function generateAndCopy(token: string, accountId: string) {
    setIsGenerating(true);

    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Generating Alias",
      });
      const generated = await generateAddress(token);
      await Clipboard.copy(generated.fullAddress);
      const aliases = await saveRecentAlias(accountId, generated);
      setRecentAliases(aliases);
      await showToast({
        style: Toast.Style.Success,
        title: "Alias Copied",
        message: generated.fullAddress,
      });
    } catch (error) {
      await showToast(
        getToastOptions(
          error,
          isDdgApiError(error) &&
            error.status === 401 &&
            accountId !== PREFERENCE_ACCOUNT_ID
            ? handleRemoveActiveAccount
            : undefined,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSetupSubmit(values: SetupFormValues) {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Signing In" });
      const loginResult = await loginWithOtp(values.username, values.otp);
      const dashboard = await getDashboard(loginResult.token);
      const accessTokenFromDashboard = dashboard.user?.access_token;

      if (!accessTokenFromDashboard) {
        throw new Error(
          "The dashboard response did not include an access token.",
        );
      }

      const nextStore = await upsertStoredAccount({
        accessToken: accessTokenFromDashboard,
        username: dashboard.user?.username || values.username,
        email: dashboard.user?.email,
      });
      const nextActiveAccount = getActiveAccount(nextStore);

      if (!nextActiveAccount) {
        throw new Error("The signed-in account could not be stored.");
      }

      setIsAddingAccount(false);
      setAccountStore(nextStore);
      await reloadRecentAliases(nextActiveAccount.id);
      await generateAndCopy(accessTokenFromDashboard, nextActiveAccount.id);
    } catch (error) {
      await showToast(getToastOptions(error));
    }
  }

  if (isLoading) {
    return <List isLoading />;
  }

  if (isAddingAccount || !accessToken) {
    return (
      <SetupForm
        defaultUsername={
          isAddingAccount
            ? ""
            : preferences.duckAddress || activeAccount?.username
        }
        onCancel={
          isAddingAccount && accessToken
            ? () => {
                setIsAddingAccount(false);
              }
            : undefined
        }
        onSubmit={handleSetupSubmit}
      />
    );
  }

  return (
    <List
      isLoading={isGenerating}
      searchBarPlaceholder="Search recent aliases"
      searchBarAccessory={
        accountStore.accounts.length > 0 ? (
          <List.Dropdown
            tooltip="Active Account"
            value={activeAccount?.id}
            onChange={handleSetActiveAccount}
          >
            {accountStore.accounts.map((account) => (
              <List.Dropdown.Item
                key={account.id}
                value={account.id}
                title={getAccountTitle(account)}
              />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      <List.Section title="Generate">
        <List.Item
          icon={Icon.PlusCircle}
          title="Generate New Duck Address"
          subtitle={
            activeAccount
              ? `Using ${getAccountTitle(activeAccount)}`
              : "Using extension preference access token"
          }
          actions={
            <ActionPanel>
              <Action
                title="Generate New Alias"
                icon={Icon.Plus}
                onAction={() =>
                  generateAndCopy(accessToken, recentAliasAccountId)
                }
              />
              <Action
                title="Add Account"
                icon={Icon.Person}
                onAction={() => {
                  setIsAddingAccount(true);
                }}
              />
              {accountStore.accounts.length > 1 ? (
                <ActionPanel.Submenu
                  title="Switch Account"
                  icon={Icon.TwoPeople}
                >
                  {accountStore.accounts.map((account) => (
                    <Action
                      key={account.id}
                      title={getAccountTitle(account)}
                      icon={
                        account.id === accountStore.activeAccountId
                          ? Icon.CheckCircle
                          : Icon.Circle
                      }
                      onAction={() => handleSetActiveAccount(account.id)}
                    />
                  ))}
                </ActionPanel.Submenu>
              ) : null}
              <Action
                title="Open Extension Preferences"
                icon={Icon.Gear}
                onAction={openExtensionPreferences}
              />
              {activeAccount ? (
                <Action
                  title="Remove Active Account"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={handleRemoveActiveAccount}
                />
              ) : null}
              {accountStore.accounts.length > 1 ? (
                <Action
                  title="Clear All Accounts"
                  icon={Icon.XMarkCircle}
                  style={Action.Style.Destructive}
                  onAction={handleClearAccounts}
                />
              ) : null}
            </ActionPanel>
          }
        />
        {activeAccount ? (
          <List.Item
            icon={Icon.Person}
            title={getAccountTitle(activeAccount)}
            subtitle={getAccountSubtitle(activeAccount)}
            accessories={[{ text: "Active" }]}
            actions={
              <ActionPanel>
                <Action
                  title="Generate New Alias"
                  icon={Icon.Plus}
                  onAction={() =>
                    generateAndCopy(accessToken, recentAliasAccountId)
                  }
                />
                <Action
                  title="Add Account"
                  icon={Icon.Person}
                  onAction={() => {
                    setIsAddingAccount(true);
                  }}
                />
                <Action
                  title="Remove Active Account"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={handleRemoveActiveAccount}
                />
              </ActionPanel>
            }
          />
        ) : null}
      </List.Section>
      <RecentAliases
        aliases={recentAliases}
        onGenerate={() => generateAndCopy(accessToken, recentAliasAccountId)}
        onClearRecentAliases={handleClearRecentAliases}
        onRemoveActiveAccount={
          activeAccount ? handleRemoveActiveAccount : undefined
        }
      />
    </List>
  );
}

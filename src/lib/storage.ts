import { LocalStorage } from "@raycast/api";
import type {
  AccountStore,
  RecentAlias,
  StoredAccount,
  StoredSession,
} from "../types/ddg";

const STORAGE_KEYS = {
  accounts: "ddg-email.accounts",
  session: "ddg-email.session",
  recentAliasesByAccount: "ddg-email.recentAliasesByAccount",
  recentAliases: "ddg-email.recentAliases",
} as const;

export const PREFERENCE_ACCOUNT_ID = "preference";

const RECENT_ALIAS_LIMIT = 20;

type RecentAliasesByAccount = Record<string, RecentAlias[]>;

type AccountInput = {
  accessToken: string;
  username?: string;
  email?: string;
  label?: string;
};

async function readJson<T>(key: string): Promise<T | undefined> {
  const raw = await LocalStorage.getItem<string>(key);

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    await LocalStorage.removeItem(key);
    return undefined;
  }
}

function createGeneratedId() {
  return `account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAccountIdentity(
  account: Pick<StoredAccount, "username" | "email">,
) {
  const username = account.username?.trim().toLowerCase();
  const email = account.email?.trim().toLowerCase();

  if (username) {
    return `username:${username}`;
  }

  if (email) {
    return `email:${email}`;
  }

  return undefined;
}

function createAccountId(account: AccountInput) {
  return getAccountIdentity(account) ?? createGeneratedId();
}

function normalizeAccountStore(store?: AccountStore): AccountStore {
  const accounts = (store?.accounts ?? []).filter(
    (account) => account.id && account.accessToken,
  );
  const activeAccountId = accounts.some(
    (account) => account.id === store?.activeAccountId,
  )
    ? store?.activeAccountId
    : accounts[0]?.id;

  return {
    accounts,
    activeAccountId,
  };
}

async function getLegacyStoredSession() {
  return readJson<StoredSession>(STORAGE_KEYS.session);
}

async function getLegacyRecentAliases() {
  return (await readJson<RecentAlias[]>(STORAGE_KEYS.recentAliases)) ?? [];
}

async function getRecentAliasesByAccount() {
  return (
    (await readJson<RecentAliasesByAccount>(
      STORAGE_KEYS.recentAliasesByAccount,
    )) ?? {}
  );
}

async function migrateLegacyRecentAliases(accountId: string) {
  const aliasesByAccount = await getRecentAliasesByAccount();

  if (aliasesByAccount[accountId]) {
    return;
  }

  const legacyAliases = await getLegacyRecentAliases();

  if (legacyAliases.length === 0) {
    return;
  }

  await LocalStorage.setItem(
    STORAGE_KEYS.recentAliasesByAccount,
    JSON.stringify({
      ...aliasesByAccount,
      [accountId]: legacyAliases.slice(0, RECENT_ALIAS_LIMIT),
    }),
  );
}

export async function getAccountStore() {
  const storedAccountStore = await readJson<AccountStore>(
    STORAGE_KEYS.accounts,
  );

  if (storedAccountStore) {
    const accountStore = normalizeAccountStore(storedAccountStore);

    if (
      accountStore.accounts.length !== storedAccountStore.accounts?.length ||
      accountStore.activeAccountId !== storedAccountStore.activeAccountId
    ) {
      await saveAccountStore(accountStore);
    }

    return accountStore;
  }

  const legacySession = await getLegacyStoredSession();

  if (!legacySession?.accessToken) {
    return { accounts: [] };
  }

  const account: StoredAccount = {
    id: createAccountId(legacySession),
    accessToken: legacySession.accessToken,
    username: legacySession.username,
    email: legacySession.email,
    updatedAt: legacySession.updatedAt,
  };
  const accountStore = {
    accounts: [account],
    activeAccountId: account.id,
  };

  await saveAccountStore(accountStore);
  await migrateLegacyRecentAliases(account.id);

  return accountStore;
}

export async function saveAccountStore(accountStore: AccountStore) {
  await LocalStorage.setItem(
    STORAGE_KEYS.accounts,
    JSON.stringify(normalizeAccountStore(accountStore)),
  );
}

export async function getActiveAccount() {
  const accountStore = await getAccountStore();

  return accountStore.accounts.find(
    (account) => account.id === accountStore.activeAccountId,
  );
}

export async function upsertStoredAccount(account: AccountInput) {
  const accountStore = await getAccountStore();
  const identity = getAccountIdentity(account);
  const existingAccount = accountStore.accounts.find((item) => {
    if (identity) {
      return getAccountIdentity(item) === identity;
    }

    return item.accessToken === account.accessToken;
  });
  const nextAccount: StoredAccount = {
    ...existingAccount,
    ...account,
    id: existingAccount?.id ?? createAccountId(account),
    updatedAt: new Date().toISOString(),
  };
  const nextAccounts = existingAccount
    ? accountStore.accounts.map((item) =>
        item.id === existingAccount.id ? nextAccount : item,
      )
    : [...accountStore.accounts, nextAccount];
  const nextStore = {
    accounts: nextAccounts,
    activeAccountId: nextAccount.id,
  };

  await saveAccountStore(nextStore);

  return nextStore;
}

export async function setActiveAccount(accountId: string) {
  const accountStore = await getAccountStore();

  if (!accountStore.accounts.some((account) => account.id === accountId)) {
    return accountStore;
  }

  const nextStore = {
    ...accountStore,
    activeAccountId: accountId,
  };

  await saveAccountStore(nextStore);

  return nextStore;
}

export async function removeStoredAccount(accountId: string) {
  const accountStore = await getAccountStore();
  const nextAccounts = accountStore.accounts.filter(
    (account) => account.id !== accountId,
  );
  const nextActiveAccountId =
    accountStore.activeAccountId === accountId
      ? nextAccounts[0]?.id
      : accountStore.activeAccountId;
  const nextStore = normalizeAccountStore({
    accounts: nextAccounts,
    activeAccountId: nextActiveAccountId,
  });

  await saveAccountStore(nextStore);

  return nextStore;
}

export async function clearStoredAccounts() {
  await Promise.all([
    saveAccountStore({ accounts: [] }),
    LocalStorage.removeItem(STORAGE_KEYS.session),
  ]);
}

export async function getRecentAliases(accountId: string) {
  await migrateLegacyRecentAliases(accountId);

  const aliasesByAccount = await getRecentAliasesByAccount();

  return aliasesByAccount[accountId] ?? [];
}

export async function saveRecentAlias(
  accountId: string,
  alias: Omit<RecentAlias, "createdAt">,
) {
  const aliasesByAccount = await getRecentAliasesByAccount();
  const aliases = await getRecentAliases(accountId);
  const nextAliases = [
    {
      ...alias,
      createdAt: new Date().toISOString(),
    },
    ...aliases.filter((item) => item.fullAddress !== alias.fullAddress),
  ].slice(0, RECENT_ALIAS_LIMIT);

  await LocalStorage.setItem(
    STORAGE_KEYS.recentAliasesByAccount,
    JSON.stringify({
      ...aliasesByAccount,
      [accountId]: nextAliases,
    }),
  );
  return nextAliases;
}

export async function clearRecentAliases(accountId: string) {
  const aliasesByAccount = await getRecentAliasesByAccount();
  const nextAliasesByAccount = { ...aliasesByAccount };

  delete nextAliasesByAccount[accountId];

  await LocalStorage.setItem(
    STORAGE_KEYS.recentAliasesByAccount,
    JSON.stringify(nextAliasesByAccount),
  );
}

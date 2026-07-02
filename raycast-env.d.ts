/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Access Token - DuckDuckGo Email Protection access token. Leave empty to sign in from the command. */
  "accessToken"?: string,
  /** Duck Address - Your main Duck address without @duck.com. Used for one-time passphrase login. */
  "duckAddress"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `generate-alias` command */
  export type GenerateAlias = ExtensionPreferences & {}
  /** Preferences accessible in the `generate-copy-alias` command */
  export type GenerateCopyAlias = ExtensionPreferences & {}
  /** Preferences accessible in the `create-forwarding-address` command */
  export type CreateForwardingAddress = ExtensionPreferences & {}
  /** Preferences accessible in the `create-copy-forwarding-address` command */
  export type CreateCopyForwardingAddress = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `generate-alias` command */
  export type GenerateAlias = {}
  /** Arguments passed to the `generate-copy-alias` command */
  export type GenerateCopyAlias = {}
  /** Arguments passed to the `create-forwarding-address` command */
  export type CreateForwardingAddress = {}
  /** Arguments passed to the `create-copy-forwarding-address` command */
  export type CreateCopyForwardingAddress = {}
}


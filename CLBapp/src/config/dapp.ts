/**
 * dApp identity / metadata.
 *
 * Single source of truth for how this app identifies itself to wallets
 * (Reown AppKit / WalletConnect), block explorers, and any external
 * service that needs a name / URL / icon for the dApp.
 *
 * Keep these values in sync with `CLBapp/app.json`:
 *   - expo.scheme                       → DAPP_NATIVE_SCHEME (without the "://")
 *   - ios.associatedDomains             → host part of DAPP_URL
 *   - android.intentFilters[*].data     → host part of DAPP_URL
 *   - expo.extra.dappUrl                → DAPP_URL
 *   - expo.extra.walletConnectProjectId → WALLETCONNECT_PROJECT_ID
 */

export const DAPP_NAME = 'CryptoLoanBoost';

export const DAPP_DESCRIPTION =
  'Leveraged crypto loans on BSC with up to 60x leverage and 5-level referral rewards.';

/** Public-facing URL of the dApp's web frontend. Must match the host configured for universal / app links. */
export const DAPP_URL = 'https://app.cryptoloanboost.com';

/** Custom URL scheme used to reopen the mobile app from an external wallet (must match `expo.scheme`). */
export const DAPP_NATIVE_SCHEME = 'clb://';

/** Universal link target (https) used as the fallback when the native scheme can't be resolved. */
export const DAPP_UNIVERSAL_URL = DAPP_URL;

/**
 * Reown Cloud / WalletConnect Cloud project id.
 * Get one for free at https://cloud.reown.com and place it here
 * (and mirror it in `expo.extra.walletConnectProjectId` in app.json).
 */
export const WALLETCONNECT_PROJECT_ID = 'b9d252ad0927504b56f9e3b4ce9f6e1f';

/** Public URLs of icons shown by wallets while the user is approving the connection. */
export const DAPP_ICONS: string[] = [
  `${DAPP_URL}/icon.png`,
  `${DAPP_URL}/icon-512.png`,
];

/**
 * Metadata object expected by Reown AppKit / WalletConnect
 * (`createAppKit`, `defaultWagmiConfig`, `Web3Modal`, etc.).
 *
 * @example
 * import { dappMetadata, WALLETCONNECT_PROJECT_ID } from '../config/dapp';
 * const wagmiConfig = defaultWagmiConfig({
 *   chains: [bsc],
 *   projectId: WALLETCONNECT_PROJECT_ID,
 *   metadata: dappMetadata,
 * });
 */
export const dappMetadata = {
  name: DAPP_NAME,
  description: DAPP_DESCRIPTION,
  url: DAPP_URL,
  icons: DAPP_ICONS,
  redirect: {
    native: DAPP_NATIVE_SCHEME,
    universal: DAPP_UNIVERSAL_URL,
  },
} as const;

export type DappMetadata = typeof dappMetadata;

export default dappMetadata;

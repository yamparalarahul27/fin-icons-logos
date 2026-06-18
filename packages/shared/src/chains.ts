/**
 * Chain registry. Maps our canonical chain name to the metadata we need to
 * locate logos in upstream sources. `trustwallet` is the folder name under
 * github.com/trustwallet/assets/blockchains/<folder>.
 */
export interface ChainInfo {
  /** Canonical chain name used in our data + CDN paths. */
  name: string;
  /** Human-readable label. */
  label: string;
  /** EVM chains lowercase their addresses; non-EVM keep source casing. */
  evm: boolean;
  /** Folder name under trustwallet/assets/blockchains. */
  trustwallet: string;
  /** Native coin symbol (e.g. ETH), used for the `native` pseudo-asset. */
  nativeSymbol: string;
  /** Native coin display name. */
  nativeName: string;
}

export const CHAINS: Record<string, ChainInfo> = {
  bitcoin: {
    name: "bitcoin",
    label: "Bitcoin",
    evm: false,
    trustwallet: "bitcoin",
    nativeSymbol: "BTC",
    nativeName: "Bitcoin",
  },
  dogecoin: {
    name: "dogecoin",
    label: "Dogecoin",
    evm: false,
    // TrustWallet's folder for Dogecoin is `doge`, not `dogecoin`.
    trustwallet: "doge",
    nativeSymbol: "DOGE",
    nativeName: "Dogecoin",
  },
  ethereum: {
    name: "ethereum",
    label: "Ethereum",
    evm: true,
    trustwallet: "ethereum",
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
  },
  smartchain: {
    name: "smartchain",
    label: "BNB Smart Chain",
    evm: true,
    trustwallet: "smartchain",
    nativeSymbol: "BNB",
    nativeName: "BNB",
  },
  polygon: {
    name: "polygon",
    label: "Polygon",
    evm: true,
    trustwallet: "polygon",
    nativeSymbol: "POL",
    nativeName: "Polygon",
  },
  solana: {
    name: "solana",
    label: "Solana",
    evm: false,
    trustwallet: "solana",
    nativeSymbol: "SOL",
    nativeName: "Solana",
  },
};

export type ChainName = keyof typeof CHAINS;

/** Reserved address for native L1 coins that have no contract. */
export const NATIVE_ADDRESS = "native";

/** Normalize an address for storage: lowercase for EVM, untouched otherwise. */
export function normalizeAddress(address: string, evm: boolean): string {
  return evm ? address.toLowerCase() : address;
}

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
  // Pseudo-chain for non-token entities. DeFi protocols are keyed
  // `protocol:<slug>` (e.g. protocol:lido) so they reuse the (chain, address)
  // model, CDN paths, and UI without a schema change.
  protocol: {
    name: "protocol",
    label: "Protocol",
    evm: false,
    trustwallet: "",
    nativeSymbol: "",
    nativeName: "",
  },
  // Pseudo-chain for network/L1-L2 logos, keyed `network:<slug>` (network:base).
  network: {
    name: "network",
    label: "Network",
    evm: false,
    trustwallet: "",
    nativeSymbol: "",
    nativeName: "",
  },
};

export type ChainName = keyof typeof CHAINS;

/** Top-level category of an asset. Derived from the chain namespace. */
export type AssetKind = "token" | "protocol" | "network" | "wallet";

/**
 * The kind of an asset, derived from its chain. Non-token entities use a
 * pseudo-chain namespace (`protocol`, `network`, `wallet`); everything else is a
 * token. Kept derived (not stored) so the manifest needs no schema change.
 */
export function kindOf(chain: string): AssetKind {
  if (chain === "protocol") return "protocol";
  if (chain === "network") return "network";
  if (chain === "wallet") return "wallet";
  return "token";
}

/** Reserved address for native L1 coins that have no contract. */
export const NATIVE_ADDRESS = "native";

/** Normalize an address for storage: lowercase for EVM, untouched otherwise. */
export function normalizeAddress(address: string, evm: boolean): string {
  return evm ? address.toLowerCase() : address;
}

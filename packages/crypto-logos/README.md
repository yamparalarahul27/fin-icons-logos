# @hirahul/crypto-logos

Up-to-date crypto token logos as **stable CDN URLs** and a **React component**.
Backed by the [fin-icons-logos](https://icons.hirahul.xyz) registry.

> The package name scope (`@hirahul`) is a placeholder — set it to your npm org
> before publishing.

## Install

```bash
npm install @hirahul/crypto-logos
```

## Usage

### URL helper (framework-agnostic)

```ts
import { getLogoUrl } from "@hirahul/crypto-logos";

getLogoUrl({ chain: "dogecoin", address: "native" });
// https://cdn.defitriangle.xyz/logos/dogecoin/native/256.png

getLogoUrl({ chain: "ethereum", address: "0xA0b8…eb48", size: 64 });
// EVM addresses are lowercased to match storage
```

### React component

```tsx
import { TokenIcon } from "@hirahul/crypto-logos/react";

<TokenIcon chain="solana" address="EKpQ…zcjm" size={32} />;
```

Falls back to a neutral placeholder if a logo isn't available. It uses an
`onError` handler, so in Next.js App Router use it from a Client Component.

## API

- `getLogoUrl({ chain, address, size?, baseUrl? })` → `string`
- `normalizeAddress(chain, address)` → `string`
- `LOGO_SIZES`, `DEFAULT_BASE_URL`, `NATIVE_ADDRESS`
- `TokenIcon` (from `@hirahul/crypto-logos/react`)

Sizes: `32 | 64 | 128 | 256`. For guaranteed-fresh (cache-busted) URLs, query the
JSON API at `/api/v1` instead — these CDN URLs are immutable and may lag a logo
update until the edge cache expires.

import { apiJson, apiOptions } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/** API index — discoverable list of endpoints. */
export function GET() {
  return apiJson({
    name: "fin-icons-logos API",
    version: "v1",
    endpoints: {
      assets: "/api/v1/assets?chain=&symbol=&verified=&limit=&offset=",
      asset: "/api/v1/assets/{chain}/{address}",
      search: "/api/v1/search?q=&limit=",
      recent: "/api/v1/recent?limit=",
    },
  });
}

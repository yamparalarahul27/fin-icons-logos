import { notFound } from "next/navigation";
import { loadCatalog } from "../../../../lib/manifest";
import { AssetDetail } from "./asset-detail";

export const dynamic = "force-dynamic";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ chain: string; address: string }>;
}) {
  const { chain, address } = await params;
  const decodedAddress = decodeURIComponent(address);

  const catalog = await loadCatalog();
  const asset = catalog.find((a) => a.chain === chain && a.address === decodedAddress);
  if (!asset) notFound();

  return <AssetDetail asset={asset} />;
}

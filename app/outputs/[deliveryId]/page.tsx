import type { Metadata } from "next";
import { DeliveryDetail } from "./delivery-detail";

export const metadata: Metadata = {
  title: "Entrega | Social Media Automator",
  description: "Detalhe do pacote final salvo no storage.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OutputsDetailPageProps = {
  params: Promise<{
    deliveryId: string;
  }>;
};

export default async function OutputsDetailPage({
  params,
}: OutputsDetailPageProps) {
  const { deliveryId } = await params;

  return <DeliveryDetail deliveryId={deliveryId} />;
}

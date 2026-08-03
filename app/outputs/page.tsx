import type { Metadata } from "next";
import { DeliveryLibrary } from "./delivery-library";

export const metadata: Metadata = {
  title: "Entregas | Social Media Automator",
  description: "Biblioteca de pacotes finais salvos no storage.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OutputsPage() {
  return <DeliveryLibrary />;
}

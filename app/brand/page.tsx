import type { Metadata } from "next";
import { BrandProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Brand Foundation | Social Media Automator",
  description: "Marco 1 brand foundation for the Social Media Automator.",
};

export default function BrandPage() {
  return <BrandProfileForm />;
}

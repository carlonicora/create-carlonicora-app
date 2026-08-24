import { generateSpecificMetadata } from "@/utils/metadata";
import { ProductsListContainer } from "@carlonicora/nextjs-jsonapi/billing";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t("billing.admin.products.title") });
}

/**
 * The container owns ProductProvider and the page shell. It has to: a Server
 * Component cannot pass `Modules.StripeProduct` to a client component — the
 * registry entry carries an icon component and methods.
 */
export default async function ProductsListPage() {
  return <ProductsListContainer />;
}

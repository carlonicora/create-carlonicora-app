import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { ProductContainer, ProductProvider } from "@carlonicora/nextjs-jsonapi/billing";
import { StripeProductInterface, StripeProductService } from "@carlonicora/nextjs-jsonapi/core";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

const getCachedProduct = cache(async (id: string): Promise<StripeProductInterface | null> => {
  try {
    return await StripeProductService.getProduct({ id });
  } catch {
    return null;
  }
});

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();
  const product = await getCachedProduct(params.id);

  if (!product) return await generateSpecificMetadata({ title: t("billing.admin.products.title") });

  return await generateSpecificMetadata({ title: `[${t("billing.admin.products.title")}] ${product.name}` });
}

export default async function ProductPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = await props.params;
  await requireAdministrator(params.locale);

  const product = await getCachedProduct(params.id);
  if (!product) notFound();

  return (
    <ProductProvider dehydratedProduct={product.dehydrate()}>
      <ProductContainer />
    </ProductProvider>
  );
}

import { generateSpecificMetadata } from "@/utils/metadata";
import { ProductContainer, ProductProvider } from "@carlonicora/nextjs-jsonapi/billing";
import { StripeProductInterface, StripeProductService } from "@carlonicora/nextjs-jsonapi/core";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
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

export default async function ProductPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  if (!(await ServerSession.hasRole(RoleId.Administrator))) notFound();

  const product = await getCachedProduct(params.id);
  if (!product) notFound();

  return (
    <ProductProvider dehydratedProduct={product.dehydrate()}>
      <ProductContainer />
    </ProductProvider>
  );
}

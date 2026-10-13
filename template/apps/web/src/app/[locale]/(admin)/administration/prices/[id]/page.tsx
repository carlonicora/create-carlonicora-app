import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { PriceContainer, PriceProvider } from "@carlonicora/nextjs-jsonapi/billing";
import { StripePriceInterface, StripePriceService } from "@carlonicora/nextjs-jsonapi/core";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

const getCachedPrice = cache(async (id: string): Promise<StripePriceInterface | null> => {
  try {
    return await StripePriceService.getPrice({ id });
  } catch {
    return null;
  }
});

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();
  const price = await getCachedPrice(params.id);

  if (!price) return await generateSpecificMetadata({ title: t("billing.admin.prices.title") });

  return await generateSpecificMetadata({
    title: `[${t("billing.admin.prices.title")}] ${price.nickname ?? price.stripePriceId}`,
  });
}

export default async function PricePage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = await props.params;
  await requireAdministrator(params.locale);

  const price = await getCachedPrice(params.id);
  if (!price) notFound();

  return (
    <PriceProvider dehydratedPrice={price.dehydrate()}>
      <PriceContainer />
    </PriceProvider>
  );
}

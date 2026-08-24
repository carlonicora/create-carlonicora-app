import { HowToContainer } from "@carlonicora/nextjs-jsonapi/components";
import { HowToProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { generateSpecificMetadata } from "@/utils/metadata";
import { Action, HowToInterface, HowToService, Modules } from "@carlonicora/nextjs-jsonapi/core";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

const getCachedHowTo = cache(async (id: string) => HowToService.findOne({ id }));

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();

  const howTo: HowToInterface = await getCachedHowTo(params.id);

  const title = (await ServerSession.hasPermissionToModule({
    module: Modules.HowTo,
    action: Action.Read,
    data: howTo,
  }))
    ? `[${t(`entities.howtos`, { count: 1 })}] ${howTo.name}`
    : `${t(`entities.howtos`, { count: 1 })}`;

  return await generateSpecificMetadata({ title: title });
}

export default async function HowToPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const howTo: HowToInterface = await getCachedHowTo(params.id);

  await ServerSession.checkPermission({ module: Modules.HowTo, action: Action.Read, data: howTo });

  return (
    <HowToProvider dehydratedHowTo={howTo.dehydrate()}>
      <HowToContainer />
    </HowToProvider>
  );
}

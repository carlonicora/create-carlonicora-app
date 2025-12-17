import { generateSpecificMetadata } from "@/utils/metadata";
import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/core";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return await generateSpecificMetadata({});
}

export default async function ActivatePage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.ActivateAccount} params={{ code: params.code }} />;
}

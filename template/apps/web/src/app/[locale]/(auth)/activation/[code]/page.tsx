import { generateSpecificMetadata } from "@/utils/metadata";
import { AuthComponent, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return await generateSpecificMetadata({});
}

export default async function ActivatePage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.ActivateAccount} params={{ code: params.code }} />;
}

import { AuthComponent, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";

export default async function InvitationPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.AcceptInvitation} params={{ code: params.code }} />;
}

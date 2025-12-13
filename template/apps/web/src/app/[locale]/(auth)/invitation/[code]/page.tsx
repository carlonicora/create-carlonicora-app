import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/features";

export default async function InvitationPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.AcceptInvitation} params={{ code: params.code }} />;
}

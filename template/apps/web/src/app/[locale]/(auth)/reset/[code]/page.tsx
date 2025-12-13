import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/features";

export default async function ResetPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.ResetPassword} params={{ code: params.code }} />;
}

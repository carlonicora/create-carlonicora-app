import { AuthComponent, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";

export default async function ResetPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return <AuthContainer componentType={AuthComponent.ResetPassword} params={{ code: params.code }} />;
}

import { Cookies } from "@carlonicora/nextjs-jsonapi/components";
import { AuthInterface, AuthService } from "@carlonicora/nextjs-jsonapi/features";

export default async function AuthPage(props: { searchParams: Promise<{ code: string }> }) {
  const searchParams = await props.searchParams;
  const auth: AuthInterface = await AuthService.findToken({
    tokenCode: searchParams.code,
  });

  return <Cookies dehydratedAuth={auth.dehydrate()} />;
}

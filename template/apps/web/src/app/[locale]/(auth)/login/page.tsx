import { AuthComponent, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";

export default async function LoginPage() {
  return <AuthContainer componentType={AuthComponent.Login} />;
}

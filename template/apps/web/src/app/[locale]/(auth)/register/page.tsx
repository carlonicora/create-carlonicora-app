import { AuthComponent, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";

export default async function RegisterPage() {
  return <AuthContainer componentType={AuthComponent.Register} />;
}

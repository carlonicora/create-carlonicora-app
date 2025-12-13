import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/features";

export default async function LoginPage() {
  return <AuthContainer componentType={AuthComponent.Login} />;
}

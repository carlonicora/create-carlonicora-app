import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/features";

export default async function RegisterPage() {
  return <AuthContainer componentType={AuthComponent.Register} />;
}

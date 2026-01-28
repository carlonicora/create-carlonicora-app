import { FeatureIds } from "@/enums/feature.ids";
import {
  AuthModule,
  AuthorModule,
  BackupCodeVerifyModule,
  BillingModule,
  CompanyModule,
  ContentModule,
  DataClassRegistry,
  FeatureModule,
  FieldSelector,
  ModuleModule,
  ModuleRegistry,
  ModuleWithPermissions,
  NotificationModule,
  OAuthModule,
  PasskeyModule,
  PasskeyRegistrationOptionsModule,
  PasskeyRegistrationVerifyModule,
  PasskeyRenameModule,
  PasskeyVerifyLoginModule,
  PasskeyAuthenticationOptionsModule,
  PushModule,
  RoleModule,
  S3Module,
  setBootstrapper,
  StripeCustomerModule,
  StripeInvoiceModule,
  StripePaymentMethodModule,
  StripePriceModule,
  StripeProductModule,
  StripePromotionCodeModule,
  StripeSubscriptionModule,
  StripeUsageModule,
  TotpAuthenticatorModule,
  TotpSetupModule,
  TotpVerifyLoginModule,
  TotpVerifyModule,
  TwoFactorChallengeModule,
  TwoFactorEnableModule,
  TwoFactorStatusModule,
  UserModule,
  WaitlistModule,
  WaitlistStatsModule,
} from "@carlonicora/nextjs-jsonapi/core";
import { LucideIcon } from "lucide-react";

// Feature module imports

const moduleFactory = (params: {
  pageUrl?: string;
  name: string;
  cache?: string;
  model: any;
  feature?: FeatureIds;
  moduleId?: string;
  icon?: LucideIcon;
  inclusions?: Record<string, { types?: string[]; fields?: FieldSelector<any>[] }>;
}): ModuleWithPermissions => ({
  pageUrl: params.pageUrl,
  name: params.name,
  model: params.model,
  feature: params.feature,
  moduleId: params.moduleId,
  cache: params.cache,
  icon: params.icon,
  inclusions: params.inclusions ?? {},
});

// SINGLE SOURCE OF TRUTH: Define ALL modules ONCE as object
// TypeScript infers types from this object
const allModules = {
  // Foundation modules (types defined in library, code in app except S3)
  Auth: AuthModule(moduleFactory),
  Company: CompanyModule(moduleFactory),
  Feature: FeatureModule(moduleFactory),
  Module: ModuleModule(moduleFactory),
  Notification: NotificationModule(moduleFactory),
  Push: PushModule(moduleFactory),
  Role: RoleModule(moduleFactory),
  S3: S3Module(moduleFactory),
  User: UserModule(moduleFactory),
  Author: AuthorModule(moduleFactory),
  Content: ContentModule(moduleFactory),
  // Billing modules
  StripeCustomer: StripeCustomerModule(moduleFactory),
  StripePaymentMethod: StripePaymentMethodModule(moduleFactory),
  StripeSubscription: StripeSubscriptionModule(moduleFactory),
  StripeProduct: StripeProductModule(moduleFactory),
  StripePrice: StripePriceModule(moduleFactory),
  StripeInvoice: StripeInvoiceModule(moduleFactory),
  Billing: BillingModule(moduleFactory),
  StripeUsage: StripeUsageModule(moduleFactory),
  StripePromotionCode: StripePromotionCodeModule(moduleFactory),
  // OAuth module
  OAuth: OAuthModule(moduleFactory),
  // Waitlist modules
  Waitlist: WaitlistModule(moduleFactory),
  WaitlistStats: WaitlistStatsModule(moduleFactory),
  // Two-factor authentication modules
  TotpAuthenticator: TotpAuthenticatorModule(moduleFactory),
  TotpSetup: TotpSetupModule(moduleFactory),
  TotpVerify: TotpVerifyModule(moduleFactory),
  TotpVerifyLogin: TotpVerifyLoginModule(moduleFactory),
  Passkey: PasskeyModule(moduleFactory),
  PasskeyRegistrationOptions: PasskeyRegistrationOptionsModule(moduleFactory),
  PasskeyRegistrationVerify: PasskeyRegistrationVerifyModule(moduleFactory),
  PasskeyRename: PasskeyRenameModule(moduleFactory),
  PasskeyVerifyLogin: PasskeyVerifyLoginModule(moduleFactory),
  PasskeyAuthenticationOptions: PasskeyAuthenticationOptionsModule(moduleFactory),
  TwoFactorEnable: TwoFactorEnableModule(moduleFactory),
  TwoFactorChallenge: TwoFactorChallengeModule(moduleFactory),
  TwoFactorStatus: TwoFactorStatusModule(moduleFactory),
  BackupCodeVerify: BackupCodeVerifyModule(moduleFactory),
} satisfies Record<string, ModuleWithPermissions>;

// Export type derived from the object - NO DUPLICATION
export type AllModuleDefinitions = typeof allModules;

let bootstrapped = false;

export function bootstrap(): void {
  if (bootstrapped) return;

  // Register ALL modules from the single source object
  Object.entries(allModules).forEach(([name, module]) => {
    ModuleRegistry.register(name, module);
  });

  // Register model classes for JSON:API response translation
  DataClassRegistry.bootstrap(allModules);

  bootstrapped = true;
}

// Register the bootstrapper immediately when this module loads.
// This enables self-healing in ModuleRegistry - if a module is accessed
// before bootstrap() is called, the registry can call bootstrap() automatically.
setBootstrapper(bootstrap);

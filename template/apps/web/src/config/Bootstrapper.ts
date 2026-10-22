import { FeatureIds } from "@/enums/feature.ids";
import {
  AiConnectionModule,
  analyticsModules,
  AssistantActionModule,
  AssistantMessageModule,
  AssistantModule,
  AuditLogModule,
  AuthModule,
  AuthorModule,
  BackupCodeVerifyModule,
  BillingModule,
  ChunkModule,
  CompanyModule,
  ContentModule,
  DataClassRegistry,
  FeatureModule,
  FieldSelector,
  HandbookPageModule,
  HandbookSectionModule,
  HandbookThreadMessageModule,
  HandbookThreadModule,
  HowToModule,
  ModuleModule,
  ModulePathsModule,
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
  PermissionMappingModule,
  PushModule,
  RbacMatrixModule,
  ReferralModule,
  ReferralStatsModule,
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
  tokenUsageModules,
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
  EmailAutomationModule,
  EmailAutomationStepModule,
  EmailAutomationEnrollmentModule,
  EmailAutomationTriggerModule,
} from "@carlonicora/nextjs-jsonapi/core";
import { LucideIcon } from "lucide-react";

// Feature module imports

import { SearchModule } from "@/features/essentials/search/SearchModule";

const moduleFactory = (params: {
  pageUrl?: string;
  name: string;
  cache?: string;
  model: any;
  feature?: FeatureIds;
  moduleId?: string;
  icon?: LucideIcon;
  identifier?: string[];
  inclusions?: Record<string, { types?: string[]; fields?: FieldSelector<any>[] }>;
}): ModuleWithPermissions => {
  if (params.model) {
    params.model.identifierFields = params.identifier ?? ["name"];
  }

  return {
    pageUrl: params.pageUrl,
    name: params.name,
    model: params.model,
    feature: params.feature,
    moduleId: params.moduleId,
    cache: params.cache,
    icon: params.icon,
    inclusions: params.inclusions ?? {},
  };
};

// SINGLE SOURCE OF TRUTH: Define ALL modules ONCE as object
// TypeScript infers types from this object
const allModules = {
  // Foundation modules (types defined in library, code in app except S3)
  AiConnection: AiConnectionModule(moduleFactory),
  AssistantAction: AssistantActionModule(moduleFactory),
  Referral: ReferralModule(moduleFactory),
  ReferralStats: ReferralStatsModule(moduleFactory),
  AuditLog: AuditLogModule(moduleFactory),
  Auth: AuthModule(moduleFactory),
  Company: CompanyModule(moduleFactory),
  Feature: FeatureModule(moduleFactory),
  Module: ModuleModule(moduleFactory),
  ModulePaths: ModulePathsModule(moduleFactory),
  Notification: NotificationModule(moduleFactory),
  PermissionMapping: PermissionMappingModule(moduleFactory),
  RbacMatrix: RbacMatrixModule(moduleFactory),
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
  // Email automation modules — the components live in
  // @carlonicora/nextjs-jsonapi/email-automations.
  EmailAutomation: EmailAutomationModule(moduleFactory),
  EmailAutomationStep: EmailAutomationStepModule(moduleFactory),
  EmailAutomationEnrollment: EmailAutomationEnrollmentModule(moduleFactory),
  EmailAutomationTrigger: EmailAutomationTriggerModule(moduleFactory),
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
  // Search module
  Search: SearchModule(moduleFactory),
  // How-to module
  HowTo: HowToModule(moduleFactory),
  // Handbook lives in the package (like tokenUsageModules below, it must be
  // imported from /core and not from the feature barrel, which tsup stamps
  // "use client").
  HandbookPage: HandbookPageModule(moduleFactory),
  HandbookSection: HandbookSectionModule(moduleFactory),
  // The handbook ask surface keeps its conversations, but not as Assistants:
  // the package Assistant is company scoped and a platform administrator has
  // no company. The handbook therefore owns its own thread and message
  // resources.
  HandbookThread: HandbookThreadModule(moduleFactory),
  HandbookThreadMessage: HandbookThreadMessageModule(moduleFactory),
  // Assistant modules
  Assistant: AssistantModule(moduleFactory),
  AssistantMessage: AssistantMessageModule(moduleFactory),
  Chunk: ChunkModule(moduleFactory),
  // One spread rather than six named entries: registration is the app's job and
  // a forgotten name is not a compile error — FoundationModuleDefinitions
  // declares all six, so Modules.X typechecks and is undefined at runtime.
  ...tokenUsageModules(moduleFactory),
  // Analytics modules
  ...analyticsModules(moduleFactory),
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

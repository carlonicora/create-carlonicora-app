import { FeatureIds } from "@/enums/feature.ids";
import {
  AuthModule,
  AuthorModule,
  CompanyModule,
  ContentModule,
  DataClassRegistry,
  FeatureModule,
  FieldSelector,
  ModuleModule,
  ModuleRegistry,
  ModuleWithPermissions,
  NotificationModule,
  PushModule,
  RoleModule,
  S3Module,
  UserModule,
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

import type { AllModuleDefinitions } from "@/config/Bootstrapper";
import type { FoundationModuleDefinitions } from "@carlonicora/nextjs-jsonapi/core";

// Simply reference the type from Bootstrapper - NO MANUAL LIST NEEDED
// This augments AppModuleDefinitions with feature modules only
// (foundation types already defined in library's FoundationModuleDefinitions)
declare module "@carlonicora/nextjs-jsonapi/core" {
  // Override the combined type to use our full definition
  interface AppModuleDefinitions extends Omit<AllModuleDefinitions, keyof FoundationModuleDefinitions> {}
}

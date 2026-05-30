// Auto-maintained by the RBAC UI. Edit via `pnpm dev` + UI, or by hand.

import { RoleId, ModuleId } from "@{{name}}/shared";
import { perm, defineRbac } from "@carlonicora/nestjs-neo4jsonapi";
import { MODULE_USER_PATHS } from "../features/rbac/module-relationships.map";

export const rbac = defineRbac<typeof MODULE_USER_PATHS>({
  [ModuleId.Feature]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Auth]: {
    default: perm.full,
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.User]: {
    default: [perm.read, perm.update("id")],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.HowTo]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Notification]: {
    default: [perm.read, perm.update],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Role]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.S3]: {
    default: [perm.read],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Company]: {
    default: [perm.read],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
});

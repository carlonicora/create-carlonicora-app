import { RbacModule } from "@carlonicora/nestjs-neo4jsonapi";
import { Module } from "@nestjs/common";
import { SearchModule } from "src/features/essentials/search/search.module";
import { MODULE_USER_PATHS } from "src/features/rbac/module-relationships.map";
import { rbac } from "src/rbac/permissions";

@Module({
  imports: [
    SearchModule,
    RbacModule.register({
      moduleUserPaths: MODULE_USER_PATHS,
      rbac,
      devMode: process.env.NODE_ENV !== "production",
    }),
  ],
})
export class FeaturesModules {}

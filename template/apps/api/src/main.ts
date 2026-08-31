// MUST stay the first import: it populates process.env for everything below.
// See src/load-env.ts for why this is an import and not an inline statement.
import "./load-env";

import * as path from "path";

import { bootstrap } from "@carlonicora/nestjs-neo4jsonapi";

import config from "src/config/config";
import { FeaturesModules } from "./features/features.modules";
import { getOpenApiConfig } from "./openapi/openapi.config";

// Queue configuration is now via baseConfig.chunkQueues in config/config.ts
bootstrap({
  appModules: [FeaturesModules],
  i18n: {
    fallbackLanguage: "en",
    path: path.join(__dirname, "i18n"),
  },
  config: config,
  contentExtension: {
    additionalRelationships: [],
  },
  openApi: getOpenApiConfig(),
});

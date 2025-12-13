import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables FIRST (before any library imports)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { bootstrap } from "@carlonicora/nestjs-neo4jsonapi";

import config from "src/config/config";
import { FeaturesModules } from "./features/features.modules";

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
});

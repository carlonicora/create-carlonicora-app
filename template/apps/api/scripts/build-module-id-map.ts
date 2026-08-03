import * as fs from "fs";
import * as path from "path";
import { ModuleId } from "@{{name}}/shared";

/**
 * Build a labelName → ModuleId UUID map.
 *
 * Convention: entity .meta.ts `labelName` values are PascalCase (e.g. "BoM",
 * "PurchaseOrderLine", "SupplierInvoice"). The ModuleId keys are also
 * PascalCase and match labelName 1:1, so no case conversion is required.
 *
 * The `generate-rbac-paths` CLI consumes this map to convert labelName-keyed
 * BFS results into UUID-keyed output used by the runtime RBAC layer.
 */
const map: Record<string, string> = {};
for (const [pascalKey, uuid] of Object.entries(ModuleId)) {
  map[pascalKey] = uuid as string;
}

const outputPath = path.resolve(__dirname, "../src/rbac/module-id.map.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(map, null, 2) + "\n");
console.log(`Wrote ${Object.keys(map).length} module mappings to ${outputPath}`);

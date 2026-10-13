import fs from "fs";
import path from "path";

/**
 * The production image installs exactly what versions.production.json pins, while
 * a scaffolded app compiles the submodules' master. The pins must therefore name
 * the latest PUBLISHED release, which is what master was when it was released.
 *
 * It compares against the npm registry, not a library checkout: a checkout inside
 * some app goes stale the moment that app stops pulling, and the check then
 * reports the checkout's age instead of the pin's. Offline, it SKIPs.
 */
const REGISTRY = "https://registry.npmjs.org";

export async function latestFromRegistry(name) {
  const response = await fetch(`${REGISTRY}/${name.replace("/", "%2f")}`, {
    headers: { accept: "application/vnd.npm.install-v1+json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`registry answered ${response.status} for ${name}`);
  return (await response.json())["dist-tags"]?.latest;
}

/** Pure comparison, so it can be tested without the network. */
export async function comparePins(pinned, latestOf) {
  const failures = [];
  for (const [name, version] of Object.entries(pinned)) {
    const latest = await latestOf(name);
    if (!latest) failures.push(`npm has no "latest" dist-tag for ${name}`);
    else if (version !== latest)
      failures.push(`versions.production.json pins ${name}@${version}, latest published is ${latest}`);
  }
  return failures;
}

export default {
  id: "production-versions",
  title: "versions.production.json pins the latest published library releases",
  async run({ templateDir }) {
    const pinned = JSON.parse(fs.readFileSync(path.join(templateDir, "versions.production.json"), "utf8"));
    try {
      return await comparePins(pinned, latestFromRegistry);
    } catch (cause) {
      const error = new Error(`npm registry unreachable (${cause.message})`);
      error.code = "SKIP";
      throw error;
    }
  },
};

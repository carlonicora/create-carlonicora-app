/**
 * supports-color is an OPTIONAL peer of debug (and propagates into the peer
 * fingerprint of everything above it — @nestjs/common, bullmq, @nestjs/bullmq,
 * @nestjs/core). The engine submodule's devDeps (semantic-release → chalk@2)
 * provide supports-color@5.5.0 in its resolution context while apps do not, so
 * the SAME packages materialise twice with different fingerprints. Duplicate
 * @nestjs/core / @nestjs/bullmq instances crash NestJS boot with
 * "UnknownDependenciesException ... ModuleRef ... BullModule" on any FRESH
 * install (stale node_modules can mask it — see pnpm-workspace.yaml §7 notes).
 *
 * Stripping the optional peer removes the fingerprint variance at the root:
 * debug falls back to its runtime require of supports-color, colours still work.
 * NEVER remove this hook without re-running the dual-instance check:
 *   ls -d node_modules/.pnpm/@nestjs+core*   # must list exactly ONE dir
 */
function readPackage(pkg) {
  if (pkg.peerDependenciesMeta && pkg.peerDependenciesMeta["supports-color"]) {
    delete pkg.peerDependenciesMeta["supports-color"];
    if (pkg.peerDependencies) delete pkg.peerDependencies["supports-color"];
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve("maplibre-gl/package.json")),
  "dist",
);
const destination = new URL("../public/maplibre/", import.meta.url);
await mkdir(destination, { recursive: true });
// MapLibre 6's module worker imports its sibling shared module.
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(source, name), new URL(name, destination));
}
await copyFile(
  join(source, "../LICENSE.txt"),
  new URL("LICENSE.txt", destination),
);

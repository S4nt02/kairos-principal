/**
 * Bundles api/index.ts into a single api/index.mjs file
 * so Vercel's serverless runtime has all dependencies resolved.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["server/vercel-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/index.mjs",
  banner: {
    js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
  },
  external: [
    // Native/binary modules that Vercel provides
    "pg-native",
    "better-sqlite3",
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  minify: false,
  sourcemap: false,
});

console.log("[build-api] api/index.mjs built successfully");

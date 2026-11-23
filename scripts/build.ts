import tailwind from "bun-plugin-tailwind";
import { cp, rm } from "node:fs/promises";

const outdir = "dist/public";

await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir,
  publicPath: "/",
  minify: true,
  plugins: [tailwind],
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp("public", outdir, { recursive: true });
console.log(`Built ${result.outputs.length} files into ${outdir}.`);

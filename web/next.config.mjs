import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Must be the monorepo root, not this app's own directory: "uganda-locale"
  // is installed via file:.. (a symlink to the sibling package), and Next's
  // serverless-function file tracer excludes any traced file that resolves
  // outside outputFileTracingRoot. Pointing this at web/ itself (which also
  // silences the "multiple lockfiles" warning) left the symlinked package's
  // dist/*.json files out of every API route's function bundle — they
  // read fine at build time but 404/ENOENT at runtime on Vercel.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;

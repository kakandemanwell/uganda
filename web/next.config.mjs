import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silences the "multiple lockfiles" warning — this app has its own
  // package-lock.json alongside the monorepo root's, since it depends on
  // the sibling uganda-locale package via file:...
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

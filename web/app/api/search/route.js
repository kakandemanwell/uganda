import * as deep from "@/lib/uganda-data.mjs";
import { ok } from "../../../lib/respond.mjs";

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";
  const level = params.get("level") ?? undefined;
  const limit = Number(params.get("limit") ?? 20);
  return ok(deep.search(q, { level, limit }));
}

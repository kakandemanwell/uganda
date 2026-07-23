import * as uganda from "@/lib/uganda-data.mjs";
import { ok } from "../../../lib/respond.mjs";

export function GET() {
  return ok(uganda.cities());
}

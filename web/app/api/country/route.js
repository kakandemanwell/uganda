import * as uganda from "uganda-locale";
import { ok } from "../../../lib/respond.mjs";

export function GET() {
  return ok(uganda.country());
}

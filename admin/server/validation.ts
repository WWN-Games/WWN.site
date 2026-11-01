import { validateContent } from "../../scripts/validate-content.ts";
import type { ValidationState } from "../shared/types.ts";

export function runValidation(): ValidationState {
  const errors = validateContent();
  return {
    ok: errors.length === 0,
    errors,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Canonical operation types written to `usage_logs.operation_type`.
 * Adding a new AI call site = adding an entry here. No free-form strings.
 */

export const OPERATION_TYPES = [
  // Material processing pipeline
  "compress_material",
  "auto_tag_material",
  "detect_category",
  "embed_material",
  "check_duplicate",

  // Item generation
  "generate_cloze",
  "generate_open",
  "generate_feynman",
  "generate_scenario",

  // Validation
  "validate_open_answer",
  "validate_feynman",
  "validate_scenario",

  // Smart layer (M2)
  "detect_gaps",
  "generate_claude_prompt",
  "generate_audit_questions",
  "cross_topic_synthesis",
  "dispute_response",

  // Smoke / health checks
  "smoke_test",
] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

/**
 * Operations that may NOT run when monthly hard limit is exceeded.
 * Critical operations (current-session validation) keep working.
 */
const NON_CRITICAL_OPERATIONS = new Set<OperationType>([
  "detect_gaps",
  "generate_claude_prompt",
  "generate_audit_questions",
  "cross_topic_synthesis",
  "compress_material",
  "auto_tag_material",
  "generate_cloze",
  "generate_open",
  "generate_feynman",
  "generate_scenario",
  "embed_material",
  "check_duplicate",
  "smoke_test",
]);

export function isNonCritical(op: OperationType): boolean {
  return NON_CRITICAL_OPERATIONS.has(op);
}

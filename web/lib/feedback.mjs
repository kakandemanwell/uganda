// Feedback links: pre-filled GitHub issues, so a report arrives already
// naming the exact record (ID, level, full path) instead of "the village
// near X is spelled wrong". No backend — the reporter files the issue from
// their own GitHub account. Client-safe (used by the /map side panel too):
// pure string building, no data imports.

export const REPO_URL = "https://github.com/kakandemanwell/uganda";

// Matches .github/ISSUE_TEMPLATE/data-correction.md at the repo root — the
// template carries the `data-correction` label (a `labels=` URL param only
// applies for users with triage access; a template's labels apply for
// everyone). The `body` param below overrides the template's own body.
const CORRECTION_TEMPLATE = "data-correction.md";

/**
 * New-issue URL for reporting a problem with one unit.
 * @param {object} o
 * @param {{ id: string, name: string, level?: string, confidence?: string }} o.unit
 * @param {string[]} [o.path]   names from region down to this unit
 * @param {string} [o.pageUrl] where the reporter was looking
 */
export function correctionIssueUrl({ unit, path = [], pageUrl }) {
  const level = unit.level ? ` (${unit.level.replace(/_/g, " ")})` : "";
  const facts = [
    `- **Unit:** ${unit.name}${level}`,
    `- **ID:** \`${unit.id}\``,
    path.length > 1 && `- **Path:** ${path.join(" › ")}`,
    unit.confidence && `- **Confidence in dataset:** ${unit.confidence}`,
    pageUrl && `- **Page:** ${pageUrl}`,
  ].filter(Boolean);

  const body = [
    ...facts,
    "",
    "### What's wrong?",
    "<!-- e.g. misspelled name, wrong parent, missing or extra village/parish, boundary in the wrong place, outdated after a new gazette -->",
    "",
    "",
    "### What should it be?",
    "",
    "",
    "### Source (if you have one)",
    "<!-- gazette / statutory instrument, EC or UBOS document, local government letter, or local knowledge -->",
    "",
  ].join("\n");

  const params = new URLSearchParams({
    template: CORRECTION_TEMPLATE,
    title: `Correction: ${unit.name}${level}`,
    body,
  });
  return `${REPO_URL}/issues/new?${params}`;
}

/** The repo's issue chooser — general feedback, not tied to one unit. */
export const FEEDBACK_URL = `${REPO_URL}/issues/new/choose`;

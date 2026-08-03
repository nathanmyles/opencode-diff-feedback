import type { Annotation } from "./types";

export function format(annotations: Annotation[]): string {
  if (annotations.length === 0) {
    return "";
  }

  const byFile = new Map<string, Annotation[]>();
  for (const ann of annotations) {
    const list = byFile.get(ann.file);
    if (list) {
      list.push(ann);
    } else {
      byFile.set(ann.file, [ann]);
    }
  }

  const parts: string[] = [
    "<diff-feedback>",
    "The user has provided inline feedback on specific code changes in your last edit. Address each annotation in your revised response:",
    "",
  ];

  for (const [file, anns] of byFile) {
    parts.push(`<file path="${escapeXml(file)}">`);
    for (const ann of anns) {
      parts.push("  <annotation" +
        ` hunk="${ann.hunkIdx}"` +
        ` line="${ann.lineIdx}">`);
      parts.push(`    <excerpt>${escapeXml(ann.excerpt)}</excerpt>`);
      parts.push(`    <feedback>${escapeXml(ann.text)}</feedback>`);
      parts.push("  </annotation>");
    }
    parts.push("</file>");
  }

  parts.push("</diff-feedback>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

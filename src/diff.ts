import type { ParsedFileDiff, Hunk, DiffLine, DiffLineType } from "./types";

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parsePatch(file: string, patch: string, status: string): ParsedFileDiff {
  const hunks: Hunk[] = [];
  const lines = patch.split("\n");

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  let currentHunk: Hunk | null = null;

  for (const rawLine of lines) {
    const hunkMatch = rawLine.match(HUNK_HEADER_RE);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
      currentHunk = {
        header: rawLine,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
      };
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (rawLine.startsWith("\\")) {
      continue;
    }

    let lineType: DiffLineType;
    let content: string;

    if (rawLine.startsWith("+")) {
      lineType = "addition";
      content = rawLine.slice(1);
    } else if (rawLine.startsWith("-")) {
      lineType = "deletion";
      content = rawLine.slice(1);
    } else if (rawLine.startsWith(" ")) {
      lineType = "context";
      content = rawLine.slice(1);
    } else {
      lineType = "context";
      content = rawLine;
    }

    // Track line numbers with running counters per hunk
    const lines = currentHunk.lines;
    let oldLine: number | null;
    let newLine: number | null;

    if (lineType === "addition") {
      oldLine = null;
      const last = lastWithNewLine(lines);
      newLine = last !== null ? last.newLine! + 1 : currentHunk.newStart;
    } else if (lineType === "deletion") {
      newLine = null;
      const last = lastWithOldLine(lines);
      oldLine = last !== null ? last.oldLine! + 1 : currentHunk.oldStart;
    } else {
      // context
      const lastOld = lastWithOldLine(lines);
      oldLine = lastOld !== null ? lastOld.oldLine! + 1 : currentHunk.oldStart;
      const lastNew = lastWithNewLine(lines);
      newLine = lastNew !== null ? lastNew.newLine! + 1 : currentHunk.newStart;
    }

    currentHunk.lines.push({ type: lineType, content, oldLine, newLine });
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    file,
    status: status as ParsedFileDiff["status"],
    hunks,
  };
}

function lastWithOldLine(lines: DiffLine[]): DiffLine | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].oldLine !== null) return lines[i];
  }
  return null;
}

function lastWithNewLine(lines: DiffLine[]): DiffLine | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].newLine !== null) return lines[i];
  }
  return null;
}

export interface SnapshotFileDiff {
  file: string;
  patch: string;
  status: string;
}

export function parseDiffs(diffs: SnapshotFileDiff[]): ParsedFileDiff[] {
  return diffs.map((d) => parsePatch(d.file, d.patch, d.status));
}

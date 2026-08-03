import { expect, test } from "bun:test";
import {
  setDiffs,
  getDiffs,
  removeFileDiff,
  addAnnotation,
  removeAnnotation,
  editAnnotation,
  allAnnotations,
  clear,
} from "../src/store";
import type { ParsedFileDiff, Annotation } from "../src/types";

const sampleDiff: ParsedFileDiff = {
  file: "test.ts",
  status: "modified",
  hunks: [
    {
      header: "@@ -1,3 +1,4 @@",
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      lines: [
        { type: "context", content: "a", oldLine: 1, newLine: 1 },
        { type: "deletion", content: "b", oldLine: 2, newLine: null },
        { type: "addition", content: "c", oldLine: null, newLine: 2 },
        { type: "context", content: "d", oldLine: 3, newLine: 3 },
      ],
    },
  ],
};

test("setDiffs and getDiffs", () => {
  setDiffs("sess1", [sampleDiff]);
  const result = getDiffs("sess1");
  expect(result.length).toBe(1);
  expect(result[0].file).toBe("test.ts");
});

test("setDiffs replaces previous diffs", () => {
  setDiffs("sess2", [sampleDiff]);
  expect(getDiffs("sess2").length).toBe(1);

  setDiffs("sess2", []);
  expect(getDiffs("sess2").length).toBe(0);
});

test("addAnnotation and allAnnotations", () => {
  setDiffs("sess3", [sampleDiff]);
  const ann = addAnnotation("sess3", {
    file: "test.ts",
    hunkIdx: 0,
    lineIdx: 1,
    line: sampleDiff.hunks[0].lines[1],
    excerpt: "b",
    text: "This should be kept",
  });

  expect(ann.id).toBe("df-1");
  expect(ann.text).toBe("This should be kept");
  expect(ann.timestamp).toBeGreaterThan(0);

  const all = allAnnotations("sess3");
  expect(all.length).toBe(1);
  expect(all[0].id).toBe("df-1");
});

test("annotations get sequential IDs", () => {
  setDiffs("sess4", [sampleDiff]);
  const a1 = addAnnotation("sess4", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "first",
  });
  const a2 = addAnnotation("sess4", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "second",
  });
  expect(a1.id).toBe("df-1");
  expect(a2.id).toBe("df-2");
});

test("removeAnnotation", () => {
  setDiffs("sess5", [sampleDiff]);
  const ann = addAnnotation("sess5", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "to remove",
  });
  expect(allAnnotations("sess5").length).toBe(1);
  removeAnnotation("sess5", ann.id);
  expect(allAnnotations("sess5").length).toBe(0);
});

test("editAnnotation", () => {
  setDiffs("sess6", [sampleDiff]);
  const ann = addAnnotation("sess6", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "original",
  });
  editAnnotation("sess6", ann.id, "updated");
  expect(allAnnotations("sess6")[0].text).toBe("updated");
});

test("clear removes session data", () => {
  setDiffs("sess7", [sampleDiff]);
  addAnnotation("sess7", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "should be cleared",
  });
  clear("sess7");
  expect(getDiffs("sess7").length).toBe(0);
  expect(allAnnotations("sess7").length).toBe(0);
});

test("removeFileDiff drops the file's diff and its annotations", () => {
  const other: ParsedFileDiff = { ...sampleDiff, file: "other.ts" };
  setDiffs("sess8", [sampleDiff, other]);
  addAnnotation("sess8", {
    file: "test.ts", hunkIdx: 0, lineIdx: 0,
    line: sampleDiff.hunks[0].lines[0],
    excerpt: "a", text: "orphaned",
  });
  addAnnotation("sess8", {
    file: "other.ts", hunkIdx: 0, lineIdx: 0,
    line: other.hunks[0].lines[0],
    excerpt: "a", text: "kept",
  });

  removeFileDiff("sess8", "test.ts");

  expect(getDiffs("sess8").map((d) => d.file)).toEqual(["other.ts"]);
  expect(allAnnotations("sess8").map((a) => a.file)).toEqual(["other.ts"]);
});

test("removeFileDiff is a no-op for unknown files", () => {
  setDiffs("sess9", [sampleDiff]);
  removeFileDiff("sess9", "missing.ts");
  expect(getDiffs("sess9").length).toBe(1);
});

test("different sessions do not collide", () => {
  setDiffs("sessA", [sampleDiff]);
  setDiffs("sessB", []);

  expect(getDiffs("sessA").length).toBe(1);
  expect(getDiffs("sessB").length).toBe(0);
});

import { expect, test } from "bun:test";
import { parsePatch, parseDiffs } from "../src/diff";

const simpleModification = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -10,7 +10,8 @@
 context line
-old line
+new line
+another new line
 context line
`;

test("parses a simple modification", () => {
  const result = parsePatch("test.ts", simpleModification, "modified");
  expect(result.file).toBe("test.ts");
  expect(result.status).toBe("modified");
  expect(result.hunks.length).toBe(1);

  const hunk = result.hunks[0];
  expect(hunk.header).toBe("@@ -10,7 +10,8 @@");
  expect(hunk.oldStart).toBe(10);
  expect(hunk.oldCount).toBe(7);
  expect(hunk.newStart).toBe(10);
  expect(hunk.newCount).toBe(8);

  const lines = hunk.lines;
  expect(lines.length).toBe(5);

  expect(lines[0].type).toBe("context");
  expect(lines[0].content).toBe("context line");

  expect(lines[1].type).toBe("deletion");
  expect(lines[1].content).toBe("old line");
  expect(lines[1].oldLine).toBe(11);
  expect(lines[1].newLine).toBeNull();

  expect(lines[2].type).toBe("addition");
  expect(lines[2].content).toBe("new line");
  expect(lines[2].oldLine).toBeNull();
  expect(lines[2].newLine).toBe(11);

  expect(lines[3].type).toBe("addition");
  expect(lines[3].content).toBe("another new line");
  expect(lines[3].oldLine).toBeNull();
  expect(lines[3].newLine).toBe(12);

  expect(lines[4].type).toBe("context");
  expect(lines[4].content).toBe("context line");
  expect(lines[4].oldLine).toBe(12);
  expect(lines[4].newLine).toBe(13);
});

const addedFile = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+line one
+line two
+line three
`;

test("parses an added file", () => {
  const result = parsePatch("newfile.ts", addedFile, "added");
  expect(result.file).toBe("newfile.ts");
  expect(result.status).toBe("added");
  expect(result.hunks.length).toBe(1);

  const lines = result.hunks[0].lines;
  expect(lines.length).toBe(3);
  expect(lines.every((l) => l.type === "addition")).toBe(true);
  expect(lines[0].content).toBe("line one");
  expect(lines[1].content).toBe("line two");
  expect(lines[2].content).toBe("line three");
});

const deletedFile = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
--- a/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line one
-line two
-line three
`;

test("parses a deleted file", () => {
  const result = parsePatch("deleted.ts", deletedFile, "deleted");
  expect(result.file).toBe("deleted.ts");
  expect(result.status).toBe("deleted");
  expect(result.hunks.length).toBe(1);

  const lines = result.hunks[0].lines;
  expect(lines.length).toBe(3);
  expect(lines.every((l) => l.type === "deletion")).toBe(true);
  expect(lines[0].content).toBe("line one");
  expect(lines[1].content).toBe("line two");
  expect(lines[2].content).toBe("line three");
});

const multipleHunks = `diff --git a/multi.ts b/multi.ts
--- a/multi.ts
+++ b/multi.ts
@@ -1,3 +1,4 @@
 a
-b
+c
 d
@@ -10,5 +10,6 @@
 keep
-remove
+add
 stay
`;

test("parses multiple hunks", () => {
  const result = parsePatch("multi.ts", multipleHunks, "modified");
  expect(result.hunks.length).toBe(2);

  expect(result.hunks[0].lines.length).toBe(4);
  expect(result.hunks[0].lines[0].type).toBe("context");
  expect(result.hunks[0].lines[1].type).toBe("deletion");
  expect(result.hunks[0].lines[2].type).toBe("addition");
  expect(result.hunks[0].lines[3].type).toBe("context");

  expect(result.hunks[1].lines.length).toBe(4);
  expect(result.hunks[1].lines[0].type).toBe("context");
  expect(result.hunks[1].lines[1].type).toBe("deletion");
  expect(result.hunks[1].lines[2].type).toBe("addition");
  expect(result.hunks[1].lines[3].type).toBe("context");
});

const noTrailingNewline = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
 line1
-line2
+line2
+line3
\\ No newline at end of file
`;

test("parses diff with no trailing newline marker", () => {
  const result = parsePatch("test.ts", noTrailingNewline, "modified");
  expect(result.hunks.length).toBe(1);
  expect(result.hunks[0].lines.length).toBe(4);
  expect(result.hunks[0].lines[0].type).toBe("context");
  expect(result.hunks[0].lines[1].type).toBe("deletion");
  expect(result.hunks[0].lines[2].type).toBe("addition");
  expect(result.hunks[0].lines[3].type).toBe("addition");
});

const multipleFiles = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,2 +1,3 @@
 a
-b
+c
diff --git a/bar.ts b/bar.ts
--- a/bar.ts
+++ b/bar.ts
@@ -1,1 +1,1 @@
-x
+y
`;

test("parses multi-file diff via parseDiffs", () => {
  const results = parseDiffs([
    { file: "foo.ts", patch: "@@ -1,2 +1,3 @@\n a\n-b\n+c", status: "modified" },
    { file: "bar.ts", patch: "@@ -1,1 +1,1 @@\n-x\n+y", status: "modified" },
  ]);
  expect(results.length).toBe(2);
  expect(results[0].file).toBe("foo.ts");
  expect(results[0].hunks.length).toBe(1);
  expect(results[1].file).toBe("bar.ts");
  expect(results[1].hunks.length).toBe(1);
});

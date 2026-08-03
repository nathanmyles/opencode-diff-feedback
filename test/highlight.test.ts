import { afterAll, describe, expect, test } from "bun:test"
import { getTreeSitterClient, hexToRgb } from "@opentui/core"
import type { ThemeTokenStyle } from "@opentui/core"
import { parsePatch } from "../src/diff"
import { buildNewContent, highlightFile, splitByLine } from "../src/highlight"
import type { ParsedFileDiff } from "../src/types"

const TEST_PALETTE: ThemeTokenStyle[] = [
  { scope: ["keyword"], style: { foreground: "#ff7b72" } },
  { scope: ["string"], style: { foreground: "#a5d6ff" } },
  { scope: ["comment"], style: { foreground: "#8b949e", italic: true } },
  { scope: ["function"], style: { foreground: "#d2a8ff" } },
  { scope: ["variable"], style: { foreground: "#e6edf3" } },
  { scope: ["type"], style: { foreground: "#ffa657" } },
  { scope: ["number"], style: { foreground: "#79c0ff" } },
  { scope: ["operator"], style: { foreground: "#ff7b72" } },
  { scope: ["punctuation"], style: { foreground: "#e6edf3" } },
  { scope: ["property", "attribute"], style: { foreground: "#79c0ff" } },
  { scope: ["tag"], style: { foreground: "#7ee787" } },
  { scope: ["constant"], style: { foreground: "#79c0ff" } },
  { scope: ["markup.heading.1", "markup.heading.2", "markup.heading.3", "markup.heading.4", "markup.heading.5", "markup.heading.6"], style: { foreground: "#e6edf3", bold: true } },
  { scope: ["markup.strong"], style: { foreground: "#e6edf3", bold: true } },
  { scope: ["markup.italic", "markup.emphasis"], style: { foreground: "#e6edf3", italic: true } },
  { scope: ["markup.link"], style: { foreground: "#79c0ff", underline: true } },
  { scope: ["markup.raw", "markup.raw.inline"], style: { foreground: "#a5d6ff" } },
  { scope: ["markup.list"], style: { foreground: "#e6edf3" } },
]

describe("buildNewContent", () => {
  test("reconstructs new file content with context and additions", () => {
    const fileDiff = parsePatch(
      "app.py",
      `--- a/app.py
+++ b/app.py
@@ -1,3 +1,5 @@
 def existing():
     return "keep"
+
+def hello():
+    return "hi"
`,
      "modified",
    )
    const content = buildNewContent(fileDiff)
    expect(content).toBe("def existing():\n    return \"keep\"\n\ndef hello():\n    return \"hi\"")
  })

  test("fills gaps for hunks that skip lines", () => {
    const fileDiff: ParsedFileDiff = {
      file: "a.py",
      status: "modified",
      hunks: [
        {
          header: "@@ -1,1 +5,1 @@",
          oldStart: 1,
          oldCount: 1,
          newStart: 5,
          newCount: 1,
          lines: [{ type: "context", content: "kept", oldLine: 1, newLine: 5 }],
        },
      ],
    }
    expect(buildNewContent(fileDiff)).toBe("\n\n\n\nkept")
  })

  test("ignores deletion lines", () => {
    const fileDiff: ParsedFileDiff = {
      file: "a.py",
      status: "modified",
      hunks: [
        {
          header: "@@ -1,2 +1,1 @@",
          oldStart: 1,
          oldCount: 2,
          newStart: 1,
          newCount: 1,
          lines: [
            { type: "deletion", content: "gone", oldLine: 1, newLine: null },
            { type: "context", content: "kept", oldLine: 2, newLine: 1 },
          ],
        },
      ],
    }
    expect(buildNewContent(fileDiff)).toBe("kept")
  })
})

describe("splitByLine", () => {
  test("splits multi-line chunk text into per-line entries", () => {
    const chunks = [
      { __isChunk: true as const, text: "def hello():\n", fg: undefined, bg: undefined, attributes: 0 },
      { __isChunk: true as const, text: "    return \"hi\"\n", fg: hexToRgb("#010203"), bg: undefined, attributes: 0 },
    ]
    const byLine = splitByLine(chunks)
    expect(byLine.get(0)).toHaveLength(1)
    expect(byLine.get(0)?.[0].text).toBe("def hello():")
    expect(byLine.get(1)?.[0].text).toBe("    return \"hi\"")
    expect(byLine.get(1)?.[0].fg).toEqual(hexToRgb("#010203"))
  })

  test("drops the trailing empty part produced by a final newline", () => {
    const chunks = [
      { __isChunk: true as const, text: "a\nb\n", fg: undefined, bg: undefined, attributes: 0 },
    ]
    const byLine = splitByLine(chunks)
    expect(byLine.get(0)?.[0].text).toBe("a")
    expect(byLine.get(1)?.[0].text).toBe("b")
    expect(byLine.has(2)).toBe(false)
  })

  test("keeps interior empty lines", () => {
    const chunks = [
      { __isChunk: true as const, text: "a\n\nb", fg: undefined, bg: undefined, attributes: 0 },
    ]
    const byLine = splitByLine(chunks)
    expect(byLine.get(0)?.[0].text).toBe("a")
    expect(byLine.get(1)?.[0].text).toBe("")
    expect(byLine.get(2)?.[0].text).toBe("b")
  })
})

describe("highlightFile", () => {
  afterAll(() => {
    getTreeSitterClient().destroy()
  })

  test("highlights vendored python content and maps line chunks exactly", async () => {
    const fileDiff = parsePatch(
      "app.py",
      `--- a/app.py
+++ b/app.py
@@ -1,2 +1,4 @@
 def existing():
     return "keep"
+
+def hello(name):
+    return "Hello, " + name
`,
      "modified",
    )
    const chunks = await highlightFile("app.py", buildNewContent(fileDiff), TEST_PALETTE)
    for (const hunk of fileDiff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "deletion" || line.newLine == null) {
          continue
        }
        const lineChunks = chunks.get(line.newLine - 1) ?? []
        expect(lineChunks.map(chunk => chunk.text).join("")).toBe(line.content)
      }
    }
    const helloLine = chunks.get(4 - 1)
    expect(helloLine?.some(chunk => chunk.fg)).toBe(true)
  })

  test("returns an empty map for unknown filetypes", async () => {
    const chunks = await highlightFile("unknown.foo", "whatever", TEST_PALETTE)
    expect(chunks.size).toBe(0)
  })
})

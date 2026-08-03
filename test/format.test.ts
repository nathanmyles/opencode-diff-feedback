import { expect, test } from "bun:test";
import { format } from "../src/format";
import type { Annotation } from "../src/types";

const baseAnn = (overrides: Partial<Annotation>): Annotation => ({
  id: "df-1",
  file: "src/foo.ts",
  hunkIdx: 0,
  lineIdx: 12,
  line: { type: "context", content: "const result = process(data)", oldLine: 10, newLine: 10 },
  excerpt: "const result = process(data)",
  text: "Add error handling before this line",
  timestamp: Date.now(),
  ...overrides,
});

test("format returns empty string for no annotations", () => {
  expect(format([])).toBe("");
});

test("format returns XML with single annotation", () => {
  const ann = baseAnn({});
  const result = format([ann]);

  expect(result).toContain("<diff-feedback>");
  expect(result).toContain("</diff-feedback>");
  expect(result).toContain('<file path="src/foo.ts">');
  expect(result).toContain('hunk="0"');
  expect(result).toContain('line="12"');
  expect(result).toContain("<excerpt>const result = process(data)</excerpt>");
  expect(result).toContain("<feedback>Add error handling before this line</feedback>");
});

test("format groups annotations by file", () => {
  const ann1 = baseAnn({ file: "src/a.ts", excerpt: "line1", text: "fix a" });
  const ann2 = baseAnn({ file: "src/a.ts", id: "df-2", excerpt: "line2", text: "fix a again" });
  const ann3 = baseAnn({ file: "src/b.ts", id: "df-3", excerpt: "line3", text: "fix b" });

  const result = format([ann1, ann2, ann3]);

  expect(result).toContain('<file path="src/a.ts">');
  expect(result).toContain('<file path="src/b.ts">');

  const aIndex = result.indexOf('<file path="src/a.ts">');
  const bIndex = result.indexOf('<file path="src/b.ts">');
  expect(aIndex).toBeLessThan(bIndex!);
});

test("format escapes XML special characters", () => {
  const ann = baseAnn({
    excerpt: "a < b && c > d",
    text: 'use "quotes" & <amp>',
  });
  const result = format([ann]);

  expect(result).toContain("&lt;");
  expect(result).toContain("&gt;");
  expect(result).toContain("&amp;");
  expect(result).toContain("&quot;");
});

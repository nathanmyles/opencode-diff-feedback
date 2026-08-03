export type DiffLineType = "context" | "addition" | "deletion";

export type DiffLine = {
  type: DiffLineType;
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

export type Hunk = {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

export type ParsedFileDiff = {
  file: string;
  status: "added" | "deleted" | "modified";
  hunks: Hunk[];
};

export type Annotation = {
  id: string;
  file: string;
  hunkIdx: number;
  lineIdx: number;
  line: DiffLine;
  excerpt: string;
  text: string;
  timestamp: number;
};

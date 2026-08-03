import type { ParsedFileDiff, Annotation } from "./types";

type SessionData = {
  diffs: ParsedFileDiff[];
  annotations: Annotation[];
};

const data = new Map<string, SessionData>();
let idCounter = 0;

function sessionData(session: string): SessionData {
  let d = data.get(session);
  if (!d) {
    d = { diffs: [], annotations: [] };
    data.set(session, d);
  }
  return d;
}

export function setDiffs(session: string, diffs: ParsedFileDiff[]): void {
  const sd = sessionData(session);
  sd.diffs = diffs;
  // Clear previous annotations since diffs have changed
  sd.annotations = [];
  idCounter = 0;
}

export function addDiffs(session: string, diffs: ParsedFileDiff[]): void {
  const sd = sessionData(session);
  for (const d of diffs) {
    const existing = sd.diffs.findIndex((e) => e.file === d.file)
    if (existing !== -1) {
      sd.diffs[existing] = d
    } else {
      sd.diffs.push(d)
    }
  }
}

export function removeFileDiff(session: string, file: string): void {
  const sd = sessionData(session);
  const idx = sd.diffs.findIndex((d) => d.file === file);
  if (idx === -1) {
    return;
  }
  sd.diffs.splice(idx, 1);
  // Annotations reference the removed file's lines and would be orphaned.
  sd.annotations = sd.annotations.filter((a) => a.file !== file);
}

export function getDiffs(session: string): ParsedFileDiff[] {
  return sessionData(session).diffs;
}

export function addAnnotation(
  session: string,
  ann: Omit<Annotation, "id" | "timestamp">
): Annotation {
  const sd = sessionData(session);
  const annotation: Annotation = {
    ...ann,
    id: `df-${++idCounter}`,
    timestamp: Date.now(),
  };
  sd.annotations.push(annotation);
  return annotation;
}

export function removeAnnotation(session: string, id: string): void {
  const sd = sessionData(session);
  const idx = sd.annotations.findIndex((a) => a.id === id);
  if (idx !== -1) {
    sd.annotations.splice(idx, 1);
  }
}

export function editAnnotation(session: string, id: string, text: string): void {
  const sd = sessionData(session);
  const ann = sd.annotations.find((a) => a.id === id);
  if (ann) {
    ann.text = text;
    ann.timestamp = Date.now();
  }
}

export function allAnnotations(session: string): Annotation[] {
  return sessionData(session).annotations;
}

export function clear(session: string): void {
  data.delete(session);
}

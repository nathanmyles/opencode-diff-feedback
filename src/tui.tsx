/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, For, onMount } from "solid-js"
import type { TextChunk, ThemeTokenStyle } from "@opentui/core"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { parsePatch } from "./diff"
import { buildNewContent, highlightFile } from "./highlight"
import type { LineChunks } from "./highlight"
import { makeStyledText, getCoreFailure } from "./opentui"
import {
  addDiffs,
  getDiffs,
  removeFileDiff,
  addAnnotation,
  removeAnnotation,
  editAnnotation,
  allAnnotations,
  clear,
} from "./store"
import { format } from "./format"
import type { Annotation, DiffLine } from "./types"

let prompt: any = undefined
let pending: { info: any; session: string } | undefined = undefined
let injected: string | undefined = undefined
const [rev, bump] = createSignal(0)

function statusColor(status: string, theme: Record<string, string>): string {
  if (status === "added") {
    return theme.diffAdded ?? "green"
  }
  if (status === "deleted") {
    return theme.diffRemoved ?? "red"
  }
  return theme.diffModified ?? "yellow"
}

function lineSign(type: string): string {
  if (type === "addition") {
    return "+"
  }
  if (type === "deletion") {
    return "-"
  }
  return " "
}

function lineBg(type: string, theme: Record<string, string>): string | undefined {
  if (type === "addition") {
    return theme.diffAddedBg ?? "green"
  }
  if (type === "deletion") {
    return theme.diffRemovedBg ?? "red"
  }
  return undefined
}

type FlatLine = { file: string; fileIndex: number; hunkIndex: number; lineIndex: number; line: DiffLine }

function DiffReviewView(props: { api: any; params: Record<string, string> }) {
  const sessionId = () => props.params.sessionID
  const theme = () => props.api.theme.current ?? {}

  const annotationCount = createMemo(() => {
    rev()
    return allAnnotations(sessionId()).length
  })

  const diffs = createMemo(() => {
    rev()
    return [...(getDiffs(sessionId()))]
  })

  // Single flattened list of every visible line, rebuilt only when diffs() changes.
  const flatLines = createMemo<FlatLine[]>(() => {
    const out: FlatLine[] = []
    diffs().forEach((fileDiff, fileIndex) => {
      fileDiff.hunks.forEach((hunk, hunkIndex) => {
        hunk.lines.forEach((line, lineIndex) => {
          out.push({ file: fileDiff.file, fileIndex, hunkIndex, lineIndex, line })
        })
      })
    })
    return out
  })

  // Cursor is a single index into flatLines(). fileIndex/hunkIndex/lineIndex are derived, not stored.
  const [cursorIndex, setCursorIndex] = createSignal(0)
  const cursor = createMemo(() => flatLines()[cursorIndex()] ?? null)

  // Which file is shown in the tab view.
  const [activeFile, setActiveFile] = createSignal(0)

  // Start/end flatLines() index for each file, in order. Only the active file is rendered.
  const fileLineRanges = createMemo(() => {
    const ranges: Array<{ start: number; end: number }> = []
    const flat = flatLines()
    if (flat.length === 0) {
      return ranges
    }
    let start = 0
    let currentFile = flat[0].fileIndex
    flat.forEach((line, index) => {
      if (line.fileIndex !== currentFile) {
        ranges.push({ start, end: index - 1 })
        currentFile = line.fileIndex
        start = index
      }
    })
    ranges.push({ start, end: flat.length - 1 })
    return ranges
  })

  const [pendingAnnotation, setPendingAnnotation] = createSignal<{
    file: string; hunkIdx: number; lineIdx: number; line: DiffLine; excerpt: string
  } | null>(null)

  const [editing, setEditing] = createSignal<Annotation | null>(null)

  const [highlightMaps, setHighlightMaps] = createSignal<Map<string, LineChunks>>(new Map())

  function buildPalette(theme: Record<string, any>): ThemeTokenStyle[] {
    const color = (name: string, fallback: string) => theme[name] ?? fallback
    return [
      { scope: ["keyword"], style: { foreground: color("syntaxKeyword", "#ff7b72") } },
      { scope: ["string"], style: { foreground: color("syntaxString", "#a5d6ff") } },
      { scope: ["comment"], style: { foreground: color("syntaxComment", "#8b949e"), italic: true } },
      { scope: ["function"], style: { foreground: color("syntaxFunction", "#d2a8ff") } },
      { scope: ["variable"], style: { foreground: color("syntaxVariable", "#e6edf3") } },
      { scope: ["type"], style: { foreground: color("syntaxType", "#ffa657") } },
      { scope: ["number"], style: { foreground: color("syntaxNumber", "#79c0ff") } },
      { scope: ["operator"], style: { foreground: color("syntaxOperator", "#ff7b72") } },
      { scope: ["punctuation"], style: { foreground: color("syntaxPunctuation", "#e6edf3") } },
      { scope: ["property", "attribute"], style: { foreground: color("syntaxVariable", "#79c0ff") } },
      { scope: ["tag"], style: { foreground: color("syntaxKeyword", "#7ee787") } },
      { scope: ["constant"], style: { foreground: color("syntaxNumber", "#79c0ff") } },
      // Markdown headings use numbered scopes (markup.heading.1 … .6)
      { scope: ["markup.heading.1", "markup.heading.2", "markup.heading.3", "markup.heading.4", "markup.heading.5", "markup.heading.6"], style: { foreground: color("markdownHeading", "#e6edf3"), bold: true } },
      { scope: ["markup.heading"], style: { foreground: color("markdownHeading", "#e6edf3"), bold: true } },
      { scope: ["markup.strong"], style: { foreground: color("markdownStrong", "#e6edf3"), bold: true } },
      { scope: ["markup.italic", "markup.emphasis"], style: { foreground: color("markdownEmph", "#e6edf3"), italic: true } },
      { scope: ["markup.strikethrough"], style: { foreground: color("markdownText", "#8b949e") } },
      { scope: ["markup.link", "markup.link.label", "markup.link.url"], style: { foreground: color("markdownLink", "#79c0ff"), underline: true } },
      { scope: ["markup.raw", "markup.raw.inline"], style: { foreground: color("markdownCode", "#a5d6ff") } },
      { scope: ["markup.raw.block"], style: { foreground: color("markdownCodeBlock", "#a5d6ff") } },
      { scope: ["markup.list"], style: { foreground: color("markdownListItem", "#e6edf3") } },
      { scope: ["markup.quote"], style: { foreground: color("markdownBlockQuote", "#8b949e"), italic: true } },
    ]
  }

  createEffect(() => {
    const palette = buildPalette(theme())
    for (const fileDiff of diffs()) {
      const content = buildNewContent(fileDiff)
      void highlightFile(fileDiff.file, content, palette).then((chunks) => {
        setHighlightMaps((previous) => {
          if (previous.get(fileDiff.file) === chunks) {
            return previous
          }
          const next = new Map(previous)
          next.set(fileDiff.file, chunks)
          return next
        })
      })
    }
  })

  const highlightStatus = createMemo(() => {
    const maps = highlightMaps()
    let total = 0
    for (const m of maps.values()) total += m.size
    const failure = getCoreFailure()
    return failure ? `Core fail: ${String(failure)}` : `HL: ${maps.size} files, ${total} lines`
  })

  // Keep the active file and cursor in bounds as diffs appear/disappear.
  createEffect(() => {
    const ranges = fileLineRanges()
    if (ranges.length === 0) {
      return
    }
    const clamped = Math.min(activeFile(), ranges.length - 1)
    if (clamped !== activeFile()) {
      setActiveFile(clamped)
    }
    const range = ranges[clamped]
    const current = cursorIndex()
    if (range && (current < range.start || current > range.end)) {
      setCursorIndex(current < range.start ? range.start : range.end)
    }
  })

  function annotationsFor(file: string, hunkIdx: number, lineIdx: number): Annotation[] {
    return allAnnotations(sessionId()).filter(a => a.file === file && a.hunkIdx === hunkIdx && a.lineIdx === lineIdx)
  }

  function highlightChunksFor(file: string, line: DiffLine, maps: Map<string, LineChunks>): TextChunk[] | undefined {
    if (line.type === "deletion" || line.newLine == null) {
      return undefined
    }
    return maps.get(file)?.get(line.newLine - 1)
  }

  function switchFile(next: number) {
    const ranges = fileLineRanges()
    if (ranges.length === 0) {
      return
    }
    const clamped = (next + ranges.length) % ranges.length
    setActiveFile(clamped)
    const range = ranges[clamped]
    if (range) {
      setCursorIndex(range.start)
    }
  }

  function keyDown(key: any) {
    if (key.name === "j" || key.name === "down") {
      key.preventDefault()
      const range = fileLineRanges()[activeFile()]
      if (!range) {
        return
      }
      setCursorIndex(i => Math.min(i + 1, range.end))
    } else if (key.name === "k" || key.name === "up") {
      key.preventDefault()
      const range = fileLineRanges()[activeFile()]
      if (!range) {
        return
      }
      setCursorIndex(i => Math.max(i - 1, range.start))
    } else if (key.name === "right" || key.name === "l") {
      key.preventDefault()
      switchFile(activeFile() + 1)
    } else if (key.name === "left" || key.name === "h") {
      key.preventDefault()
      switchFile(activeFile() - 1)
    } else if (key.name === "c" && !pendingAnnotation() && !editing()) {
      key.preventDefault()
      const current = cursor()
      if (!current) {
        return
      }
      setPendingAnnotation({ file: current.file, hunkIdx: current.hunkIndex, lineIdx: current.lineIndex, line: current.line, excerpt: current.line.content })
    } else if (key.name === "e" && !pendingAnnotation() && !editing()) {
      key.preventDefault()
      const current = cursor()
      if (!current) {
        return
      }
      const annotations = annotationsFor(current.file, current.hunkIndex, current.lineIndex)
      if (annotations.length > 0) {
        setEditing(annotations[annotations.length - 1])
      }
    } else if (key.name === "d") {
      key.preventDefault()
      const current = cursor()
      if (!current) {
        return
      }
      const annotations = annotationsFor(current.file, current.hunkIndex, current.lineIndex)
      if (annotations.length > 0) {
        removeAnnotation(sessionId(), annotations[annotations.length - 1].id)
        bump(rev() + 1)
      }
    } else if (key.name === "escape") {
      key.preventDefault()
      if (pendingAnnotation()) {
        setPendingAnnotation(null)
        return
      }
      goBack()
    }
  }

  let mainBox: any

  onMount(() => {
    mainBox?.focus?.()
  })

  function goBack() {
    const items = allAnnotations(sessionId())
    if (items.length > 0) {
      const label = `[${items.length} diff annotation${items.length > 1 ? "s" : ""}]`
      pending = {
        session: sessionId(),
        info: {
          input: label + " ",
          parts: [{
            type: "text" as const,
            text: format(items),
            source: {
              text: {
                start: 0,
                end: label.length,
                value: label,
              },
            },
          }],
        },
      }
    }
    props.api.route.navigate("session", { sessionID: sessionId() })
  }

  function submitAnnotation(text: string) {
    const pending = pendingAnnotation()
    const current = editing()
    if (pending && text) {
      addAnnotation(sessionId(), { file: pending.file, hunkIdx: pending.hunkIdx, lineIdx: pending.lineIdx, line: pending.line, excerpt: pending.excerpt, text })
    } else if (current && text) {
      editAnnotation(sessionId(), current.id, text)
    }
    setPendingAnnotation(null)
    setEditing(null)
    bump(rev() + 1)
    setTimeout(() => mainBox?.focus?.(), 0)
  }

  function isActiveLine(fileIndex: number, hunkIndex: number, lineIndex: number): boolean {
    const current = cursor()
    return !!current && current.fileIndex === fileIndex && current.hunkIndex === hunkIndex && current.lineIndex === lineIndex
  }

  function renderInlineAnnotations(file: string, hunkIndex: number, lineIndex: number) {
    const annotations = annotationsFor(file, hunkIndex, lineIndex)
    if (annotations.length === 0) {
      return null
    }
    return (
      <For each={annotations}>
        {(annotation: Annotation) => (
          <box flexDirection="column" marginLeft={3} paddingLeft={1}>
            <text fg={theme().text ?? "white"}>▎{annotation.text}</text>
          </box>
        )}
      </For>
    )
  }

  function renderAnnotationInput() {
    const pending = pendingAnnotation()
    const editingAnnotation = editing()
    if (!pending && !editingAnnotation) {
      return null
    }
    const isEdit = !!editingAnnotation
    const placeholder = isEdit ? "Edit your feedback..." : "Type your feedback..."
    const initialValue = isEdit ? editingAnnotation!.text : ""
    return (
      <box flexDirection="column" marginLeft={3} paddingLeft={1} marginBottom={1}>
        <input
          ref={(element: any) => {
            if (element) {
              if (initialValue) {
                element.value = initialValue
              }
              element?.focus?.()
            }
          }}
          placeholder={placeholder}
          onSubmit={(event: any) => {
            const text = typeof event === "string" ? event : (event?.target?.value ?? event?.value ?? "")
            submitAnnotation(text)
          }}
          onKeyDown={(event: any) => {
            if (event.name === "escape") {
              setPendingAnnotation(null)
              setEditing(null)
              setTimeout(() => mainBox?.focus?.(), 0)
              event.preventDefault()
            }
          }}
        />
        <text fg={theme().muted ?? "gray"}>Enter {isEdit ? "save" : "submit"}, Esc cancel</text>
      </box>
    )
  }

  function renderDiffContent() {
    const diffList = diffs()
    if (!diffList || diffList.length === 0) {
      return (
        <text fg={theme().text ?? "white"}>No diffs available. Start a session and make edits first.</text>
      )
    }

    const maps = highlightMaps()
    const active = Math.min(activeFile(), diffList.length - 1)
    const fileDiff = diffList[active]

    return (
      <box flexDirection="column" flexGrow={1} minHeight={0}>
        <box flexDirection="row" marginBottom={1}>
          <For each={diffList}>
            {(file, fileIndex) => (
              <box
                flexShrink={0}
                marginRight={1}
                paddingX={1}
                paddingY={0}
                backgroundColor={fileIndex() === active ? (theme().selection ?? "blue") : undefined}
                onMouseUp={() => switchFile(fileIndex())}
              >
                <text fg={fileIndex() === active ? (theme().text ?? "white") : (theme().muted ?? "gray")}>
                  {file.file.split("/").pop()}
                </text>
              </box>
            )}
          </For>
        </box>
        <text fg={theme().muted ?? "gray"}>{highlightStatus()}</text>
        <box flexDirection="column" flexGrow={1} minHeight={0} marginBottom={1}>
          <text wrapMode="word" width="100%" fg={statusColor(fileDiff.status, theme())}>
            <b>── {fileDiff.file} ──</b>
          </text>
          <For each={fileDiff.hunks}>
            {(hunk, hunkIndex) => (
              <box flexDirection="column" flexGrow={1} minHeight={0} marginLeft={1}>
                <text wrapMode="word" width="100%" fg={theme().diffHunk ?? "cyan"}>{hunk.header}</text>
                <scrollbox scrollY={true} focusable={true} width="100%" flexGrow={1} minHeight={0}>
                  <For each={hunk.lines}>
                    {(line, lineIndex) => {
                      const chunks = highlightChunksFor(fileDiff.file, line, maps)
                      const highlighted = !!chunks && chunks.length > 0
                      const styled = highlighted ? makeStyledText(chunks) : null
                      return (
                        <box flexDirection="column" flexShrink={0}>
                          <box
                            flexDirection="row"
                            flexShrink={0}
                            width="100%"
                            backgroundColor={
                              isActiveLine(active, hunkIndex(), lineIndex())
                                ? (theme().selection ?? "blue")
                                : lineBg(line.type, theme())
                            }
                          >
                            <text width={1} fg={theme().accent ?? "yellow"}>
                              {annotationsFor(fileDiff.file, hunkIndex(), lineIndex()).length > 0 ? "●" : " "}
                            </text>
                            <text width={3} fg={theme().lineNumber ?? theme().muted ?? "gray"}>
                              {(line.type === "deletion" ? line.oldLine : line.newLine)?.toString().padStart(3) ?? "   "}
                            </text>
                            <text width={1} fg={
                              line.type === "addition" ? (theme().diffAdded ?? "green")
                              : line.type === "deletion" ? (theme().diffRemoved ?? "red")
                              : theme().muted ?? "gray"
                            }>{lineSign(line.type)}</text>
                            <text
                              flexGrow={1}
                              wrapMode="word"
                              fg={theme().text ?? "white"}
                              onMouseUp={() => {
                                const index = flatLines().findIndex(
                                  x => x.fileIndex === active && x.hunkIndex === hunkIndex() && x.lineIndex === lineIndex()
                                )
                                if (index >= 0) {
                                  setCursorIndex(index)
                                }
                                if (!pendingAnnotation() && !editing()) {
                                  setPendingAnnotation({ file: fileDiff.file, hunkIdx: hunkIndex(), lineIdx: lineIndex(), line, excerpt: line.content })
                                }
                              }}
                            >
                              {styled ?? line.content}
                            </text>
                          </box>
                          {renderInlineAnnotations(fileDiff.file, hunkIndex(), lineIndex())}
                          {(pendingAnnotation() || editing()) && isActiveLine(active, hunkIndex(), lineIndex()) ? renderAnnotationInput() : null}
                        </box>
                      )
                    }}
                  </For>
                </scrollbox>
              </box>
            )}
          </For>
        </box>
      </box>
    )
  }

  return (
    <box ref={mainBox} flexDirection="column" focusable onKeyDown={keyDown} padding={1}>
      <box marginBottom={1}>
        <text fg={theme().text ?? "white"}>
          <b>Review Diffs{annotationCount() > 0 ? `  [${annotationCount()} annotations]` : ""}</b>
        </text>
      </box>
      <box flexGrow={1} minHeight={0}>
        {renderDiffContent()}
      </box>
      <box marginTop={1}>
        <text fg={theme().muted ?? "gray"}>
          esc back  ←/→ (h/l) files  ↑/↓ (j/k) lines  c comment  e edit  d delete
        </text>
      </box>
    </box>
  )
}

const tui: TuiPlugin = async (api, _options, _meta) => {
  if (!api.slots || !api.ui?.Prompt) {
    api.ui?.toast?.({ variant: "error", message: "diff-feedback: missing required APIs (slots, Prompt)" })
    return
  }

  // Maps a permission requestID to the file it proposes to change, so that a
  // reply can drop the cached diff once the change has been applied.
  const requestFiles = new Map<string, string>()

  const unsubPermissionAsked = api.event.on("permission.asked", (event: any) => {
    const meta = event.properties?.metadata ?? {}
    const sessionID: string = event.properties?.sessionID
    if (!sessionID) {
      return
    }
    const diff = meta.diff as string
    const filepath = meta.filepath as string
    if (!diff || !filepath) {
      return
    }
    requestFiles.set(event.properties?.id, filepath)
    const status = diff.includes("--- /dev/null") ? "added" as const
      : diff.includes("+++ /dev/null") ? "deleted" as const
      : "modified" as const
    const parsed = parsePatch(filepath, diff, status)
    addDiffs(sessionID, [parsed])
    bump(rev() + 1)
  })

  const unsubPermissionReplied = api.event.on("permission.replied", (event: any) => {
    const reply = event.properties?.reply
    if (reply !== "once" && reply !== "always") {
      return
    }
    const file = requestFiles.get(event.properties?.requestID)
    requestFiles.delete(event.properties?.requestID)
    const sessionID: string = event.properties?.sessionID
    if (file && sessionID) {
      removeFileDiff(sessionID, file)
      bump(rev() + 1)
    }
  })

  api.lifecycle?.onDispose?.(unsubPermissionAsked)
  api.lifecycle?.onDispose?.(unsubPermissionReplied)

  api.slots.register({
    order: 100,
    slots: {
      session_prompt(_ctx: any, props: any) {
        return (
          <api.ui.Prompt
            visible={props.visible}
            disabled={props.disabled}
            ref={(element: any) => {
              prompt = element
              props.ref?.(element)
              if (element && pending) {
                element.set(pending.info)
                injected = pending.session
                pending = undefined
              }
            }}
            onSubmit={() => {
              if (injected) {
                clear(injected)
                injected = undefined
              }
              props.on_submit?.()
            }}
            sessionID={props.session_id}
          />
        )
      },
    },
  })

  api.route.register([
    {
      name: "diff-feedback",
      render: (input: any) => <DiffReviewView api={api} params={input.params} />,
    },
  ])

  api.command.register(() => [
    {
      title: "Review diff annotations",
      value: "diff-feedback.open",
      slash: { name: "feedback" },
      category: "Diff Feedback",
      description: "Review and annotate the latest diffs from agent changes",
      onSelect() {
        const route = api.route.current
        if (route.name !== "session") {
          api.ui.toast({ variant: "warning", message: "Open a session first" })
          return
        }
        api.route.navigate("diff-feedback", {
          sessionID: (route.params as any).sessionID,
        })
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode.diff-feedback",
  tui,
}

export default plugin

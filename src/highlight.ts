import type { TextChunk, ThemeTokenStyle, TreeSitterClient } from "@opentui/core"
import { loadOpenTuiCore } from "./opentui"
import type { CoreModule } from "./opentui"
import { knownFiletype, registerParsersOn } from "./grammars"
import type { ParsedFileDiff } from "./types"

const syntaxStyleCache = new Map<string, InstanceType<CoreModule["SyntaxStyle"]
>>()

function getSyntaxStyle(core: CoreModule, palette: ThemeTokenStyle[]): InstanceType<CoreModule["SyntaxStyle"]
> {
  const sig = JSON.stringify(palette)
  if (!syntaxStyleCache.has(sig)) {
    syntaxStyleCache.set(sig, core.SyntaxStyle.fromTheme(palette))
  }
  return syntaxStyleCache.get(sig)!
}

let parsersRegisteredOnClient = false

function ensureParsersRegistered(core: CoreModule, client: TreeSitterClient): void {
  if (parsersRegisteredOnClient) {
    return
  }
  parsersRegisteredOnClient = true
  registerParsersOn(core, client)
}

export type LineChunks = Map<number, TextChunk[]>

const cache = new Map<string, LineChunks>()

export async function highlightFile(file: string, content: string, palette: ThemeTokenStyle[]): Promise<LineChunks> {
  const core = await loadOpenTuiCore()
  if (!core) {
    return new Map()
  }
  const filetype = core.pathToFiletype(file)
  if (!filetype || !knownFiletype(filetype)) {
    return new Map()
  }
  const paletteSig = JSON.stringify(palette)
  const cacheKey = `${filetype}\u0000${content}\u0000${paletteSig}`
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }
  try {
    const client = core.getTreeSitterClient()
    ensureParsersRegistered(core, client)
    const styled = await core.treeSitterToStyledText(content, filetype, getSyntaxStyle(core, palette), client, { conceal: { enabled: false } })
    const lineChunks = splitByLine(styled.chunks)
    cache.set(cacheKey, lineChunks)
    return lineChunks
  } catch {
    return new Map()
  }
}

export function splitByLine(chunks: TextChunk[]): LineChunks {
  const lineChunks: LineChunks = new Map()
  let lineIndex = 0
  for (const chunk of chunks) {
    const parts = chunk.text.split("\n")
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) {
        lineIndex++
      }
      if (part === "" && partIndex === parts.length - 1) {
        return
      }
      const rest = lineChunks.get(lineIndex) ?? []
      rest.push({ ...chunk, text: part })
      lineChunks.set(lineIndex, rest)
    })
  }
  return lineChunks
}

export function buildNewContent(fileDiff: ParsedFileDiff): string {
  const lines: string[] = []
  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "deletion" || line.newLine == null) {
        continue
      }
      while (lines.length < line.newLine - 1) {
        lines.push("")
      }
      lines[line.newLine - 1] = line.content
    }
  }
  return lines.join("\n")
}

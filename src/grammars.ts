import { fileURLToPath } from "node:url"
import type { FiletypeParserOptions, TreeSitterClient } from "@opentui/core"
import type { CoreModule } from "./opentui"

type GrammarSource = {
  lang: string
  repo: string
  tag: string
}

const VENDORED: GrammarSource[] = [
  { lang: "python", repo: "tree-sitter/tree-sitter-python", tag: "v0.25.0" },
  { lang: "go", repo: "tree-sitter/tree-sitter-go", tag: "v0.25.0" },
  { lang: "rust", repo: "tree-sitter/tree-sitter-rust", tag: "v0.24.2" },
  { lang: "java", repo: "tree-sitter/tree-sitter-java", tag: "v0.23.5" },
  { lang: "c", repo: "tree-sitter/tree-sitter-c", tag: "v0.24.2" },
  { lang: "cpp", repo: "tree-sitter/tree-sitter-cpp", tag: "v0.23.4" },
  { lang: "ruby", repo: "tree-sitter/tree-sitter-ruby", tag: "v0.23.1" },
  { lang: "bash", repo: "tree-sitter/tree-sitter-bash", tag: "v0.25.1" },
  { lang: "json", repo: "tree-sitter/tree-sitter-json", tag: "v0.24.8" },
  { lang: "yaml", repo: "tree-sitter-grammars/tree-sitter-yaml", tag: "v0.7.2" },
  { lang: "css", repo: "tree-sitter/tree-sitter-css", tag: "v0.25.0" },
  { lang: "html", repo: "tree-sitter/tree-sitter-html", tag: "v0.23.2" },
  { lang: "php", repo: "tree-sitter/tree-sitter-php", tag: "v0.24.2" },
]

const FALLBACK: GrammarSource[] = [
  { lang: "scala", repo: "tree-sitter/tree-sitter-scala", tag: "v0.26.0" },
  { lang: "haskell", repo: "tree-sitter/tree-sitter-haskell", tag: "v0.23.1" },
  { lang: "lua", repo: "tree-sitter-grammars/tree-sitter-lua", tag: "v0.5.0" },
]

const BUNDLED_FILETYPES = new Set([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "markdown",
  "markdown_inline",
  "zig",
])

function vendorWasmPath(lang: string): string {
  return fileURLToPath(new URL(`../assets/grammars/${lang}/tree-sitter-${lang}.wasm`, import.meta.url).href)
}

function vendorQueryPath(lang: string): string {
  return fileURLToPath(new URL(`../assets/grammars/${lang}/highlights.scm`, import.meta.url).href)
}

function buildConfig(source: GrammarSource, vendored: boolean): FiletypeParserOptions {
  const wasm = vendored
    ? vendorWasmPath(source.lang)
    : `https://github.com/${source.repo}/releases/download/${source.tag}/tree-sitter-${source.lang}.wasm`
  const query = vendored
    ? vendorQueryPath(source.lang)
    : `https://raw.githubusercontent.com/${source.repo}/${source.tag}/queries/highlights.scm`
  return {
    filetype: source.lang,
    queries: { highlights: [query] },
    wasm,
  }
}

const EXTRA_PARSERS: FiletypeParserOptions[] = [
  ...VENDORED.map(source => buildConfig(source, true)),
  ...FALLBACK.map(source => buildConfig(source, false)),
]

const EXTRA_FILETYPES = new Set(EXTRA_PARSERS.map(parser => parser.filetype))

export function registerParsersOn(core: CoreModule, client: TreeSitterClient): void {
  core.addDefaultParsers(EXTRA_PARSERS)
  for (const parser of EXTRA_PARSERS) {
    client.addFiletypeParser(parser)
  }
}

export function knownFiletype(filetype: string | undefined): boolean {
  if (!filetype) {
    return false
  }
  return BUNDLED_FILETYPES.has(filetype) || EXTRA_FILETYPES.has(filetype)
}

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const GRAMMARS_DIR = join(ROOT, "assets", "grammars")

const VENDORED = [
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

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${res.statusText}`)
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

let ok = 0
for (const { lang, repo, tag } of VENDORED) {
  const dir = join(GRAMMARS_DIR, lang)
  await mkdir(dir, { recursive: true })
  const wasmUrl = `https://github.com/${repo}/releases/download/${tag}/tree-sitter-${lang}.wasm`
  const queryUrl = `https://raw.githubusercontent.com/${repo}/${tag}/queries/highlights.scm`
  try {
    await download(wasmUrl, join(dir, `tree-sitter-${lang}.wasm`))
    await download(queryUrl, join(dir, "highlights.scm"))
    ok++
    console.log(`ok ${lang}`)
  } catch (error) {
    console.log(`FAIL ${lang}: ${error.message}`)
  }
}
console.log(`${ok}/${VENDORED.length} grammars fetched`)

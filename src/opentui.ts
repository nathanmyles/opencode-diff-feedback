import type { StyledText, TextChunk } from "@opentui/core"

export type CoreModule = typeof import("@opentui/core")

let coreModule: CoreModule | null = null
let coreFailure: unknown = null
let corePromise: Promise<CoreModule | null> | null = null

export async function loadOpenTuiCore(): Promise<CoreModule | null> {
  if (coreModule) {
    return coreModule
  }
  if (coreFailure) {
    return null
  }
  if (!corePromise) {
    corePromise = (async () => {
      try {
        // The binary already has its own @opentui/core loaded; both instances
        // share a global env-registry singleton.  Wipe the registry so the
        // plugin's copy can re-register its env vars without throwing.
        const sym = Symbol.for("@opentui/core/singleton")
        const cache = (globalThis as any)[sym]
        if (cache && cache["env-registry"]) {
          delete cache["env-registry"]
        }
        coreModule = await import("@opentui/core")
        return coreModule
      } catch (error) {
        coreFailure = error
        return null
      }
    })()
  }
  return corePromise
}

export function getCoreFailure(): unknown {
  return coreFailure
}

export function makeStyledText(chunks: TextChunk[]): StyledText | null {
  if (!coreModule) {
    return null
  }
  return new coreModule.StyledText(chunks)
}

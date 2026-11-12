import { useSyncExternalStore } from 'react'
import type { NativeChatSidekickConfig } from './native-chat-sidekick'

const STORAGE_KEY = 'orca:nativeChatSidekick:v1'
const states = new Map<string, NativeChatSidekickConfig>()
const listeners = new Set<() => void>()
let loaded = false

const EMPTY: NativeChatSidekickConfig = { enabled: false }

function isSidekickConfig(value: unknown): value is NativeChatSidekickConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value &&
    typeof value.enabled === 'boolean'
  )
}

function load(): void {
  if (loaded) {
    return
  }
  loaded = true
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(stored)) {
      for (const entry of stored) {
        if (
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          entry[0].length > 0 &&
          isSidekickConfig(entry[1])
        ) {
          states.set(entry[0], entry[1])
        }
      }
    }
  } catch {
    console.warn('[native-chat-sidekick] could not read persisted sidekick state')
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...states]))
  } catch {
    console.warn('[native-chat-sidekick] could not persist sidekick state')
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function readNativeChatSidekick(sessionId: string): NativeChatSidekickConfig {
  load()
  return states.get(sessionId) ?? EMPTY
}

export function writeNativeChatSidekick(
  sessionId: string,
  patch: Partial<NativeChatSidekickConfig>
): NativeChatSidekickConfig {
  load()
  const next = { ...readNativeChatSidekick(sessionId), ...patch }
  if (patch.lastError === undefined && 'lastError' in next) {
    const { lastError: _cleared, ...rest } = next
    states.set(sessionId, rest)
  } else {
    states.set(sessionId, next)
  }
  persist()
  notify()
  return next
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNativeChatSidekick(sessionId: string | undefined): {
  config: NativeChatSidekickConfig
  update: (patch: Partial<NativeChatSidekickConfig>) => NativeChatSidekickConfig
} {
  const config = useSyncExternalStore(subscribe, () =>
    sessionId ? readNativeChatSidekick(sessionId) : EMPTY
  )
  return {
    config,
    update: (patch) => writeNativeChatSidekick(sessionId ?? '', patch)
  }
}

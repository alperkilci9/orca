import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { AGENT_CATALOG } from '@/lib/agent-catalog/agent-catalog'
import { structuredAgentSessionSeedCatalog } from '../../../../../shared/agent-session/options/structured-agent-session-seed-catalog'
import { readModelMenuCatalog } from '@/runtime/native-chat/model-catalogs/model-menu-catalog-read'
import {
  startNativeChatSidekick,
  stopNativeChatSidekick,
  type NativeChatSidekickConfig
} from './native-chat-sidekick'
import { useNativeChatSidekick } from './native-chat-sidekick-store'
import { useNativeChatPickerFocusReturn } from '../composer/focus/native-chat-picker-focus-return'

type SidekickModelRow = { id: string; label: string; efforts: { value: string; label: string }[] }

const DEFAULT_VALUE = '__default__'

function seedModelRows(agent: string): SidekickModelRow[] {
  return structuredAgentSessionSeedCatalog(agent).models.map((model) => {
    const effort = model.options.find((option) => option.id === 'effort')
    return {
      id: model.id,
      label: model.label,
      efforts: effort?.kind.type === 'select' ? effort.kind.choices : []
    }
  })
}

/** Seed rows first; the host's live listing upgrades them when it answers. */
function useSidekickModelRows(
  target: RuntimeClientTarget | null,
  agent: string | undefined,
  open: boolean
): SidekickModelRow[] {
  const seed = useMemo(() => (agent ? seedModelRows(agent) : []), [agent])
  const [live, setLive] = useState<SidekickModelRow[] | null>(null)
  useEffect(() => {
    setLive(null)
    if (!open || !target || !agent) {
      return
    }
    const controller = new AbortController()
    void readModelMenuCatalog({ target, agent }, false, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !result || result.origin === 'unknown') {
          return
        }
        const rows = result.models.map((model) => ({
          id: model.id,
          label: model.label,
          efforts: (model.chatEfforts ?? model.efforts).map((choice) => ({
            value: choice.value,
            label: choice.label
          }))
        }))
        if (rows.length > 0) {
          setLive(rows)
        }
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [open, target, agent])
  return live ?? seed
}

function sidekickLabel(
  config: NativeChatSidekickConfig,
  say: (key: string, fallback: string, options?: Record<string, string>) => string
): string {
  if (!config.enabled) {
    return say('components.native-chat.sidekick.off', 'Sidekick')
  }
  const agent = config.agent
    ? (AGENT_CATALOG.find((entry) => entry.id === config.agent)?.label ?? config.agent)
    : say('components.native-chat.sidekick.noAgent', 'no agent')
  return say('components.native-chat.sidekick.on', 'Sidekick · {{agent}}', { agent })
}

async function runSidekickToggle(args: {
  enabled: boolean
  target: RuntimeClientTarget
  sessionId: string
  agent: string
  config: NativeChatSidekickConfig
  apply: (patch: Partial<NativeChatSidekickConfig>) => void
}): Promise<void> {
  try {
    if (args.enabled) {
      const receipt = await startNativeChatSidekick({
        target: args.target,
        sessionId: args.sessionId,
        agent: args.agent,
        ...(args.config.model ? { model: args.config.model } : {}),
        ...(args.config.effort ? { effort: args.config.effort } : {})
      })
      args.apply({
        enabled: true,
        agent: args.agent,
        lastError: undefined,
        ...(receipt.dispatchId ? { dispatchId: receipt.dispatchId } : {}),
        ...(receipt.runId ? { runId: receipt.runId } : {}),
        ...(receipt.taskId ? { taskId: receipt.taskId } : {})
      })
    } else {
      const dispatchId = args.config.dispatchId
      args.apply({ enabled: false, dispatchId: undefined, runId: undefined, taskId: undefined })
      if (dispatchId) {
        await stopNativeChatSidekick({ target: args.target, dispatchId }).catch(() => undefined)
      }
    }
  } catch (error) {
    args.apply({
      enabled: false,
      lastError: error instanceof Error ? error.message : String(error)
    })
  }
}

export function NativeChatSidekickControl({
  sessionId,
  target,
  leadAgent,
  focusComposer
}: {
  sessionId: string | undefined
  target: RuntimeClientTarget | null
  leadAgent: string | undefined
  focusComposer?: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const { config, update } = useNativeChatSidekick(sessionId)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { triggerRef, onInteractOutside, onCloseAutoFocus } = useNativeChatPickerFocusReturn(
    focusComposer,
    true
  )
  const generation = useRef(0)

  const agent = config.agent ?? leadAgent
  const modelRows = useSidekickModelRows(target, agent, open)
  const modelRow = modelRows.find((row) => row.id === config.model)
  const supportsLaunchPreferences =
    agent !== undefined &&
    structuredAgentSessionSeedCatalog(agent).supportsWorkerLaunchPreferences === true

  if (!sessionId || !target) {
    return null
  }

  const apply = (patch: Partial<NativeChatSidekickConfig>) => {
    update({ ...patch, lastError: undefined })
  }

  const run = (enabled: boolean) => {
    const myGeneration = ++generation.current
    setBusy(true)
    void runSidekickToggle({
      enabled,
      target,
      sessionId,
      agent: agent!,
      config,
      apply: (patch) => {
        if (generation.current === myGeneration) {
          update(patch)
        }
      }
    }).finally(() => {
      if (generation.current === myGeneration) {
        setBusy(false)
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant={config.enabled ? 'secondary' : 'ghost'}
          size="xs"
          aria-expanded={open}
          aria-label={t('components.native-chat.sidekick.button', 'Sidekick')}
          className="shrink-0"
        >
          <Bot className="size-3.5" />
          <span className="max-w-36 truncate">{sidekickLabel(config, t)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64"
        onInteractOutside={onInteractOutside}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {t('components.native-chat.sidekick.title', 'Sidekick')}
            </span>
            <Switch
              checked={config.enabled}
              disabled={busy || !agent}
              onCheckedChange={(checked) => void run(checked)}
              aria-label={t('components.native-chat.sidekick.toggle', 'Enable Sidekick')}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t('components.native-chat.sidekick.agent', 'Agent')}
            </span>
            <Select
              value={agent ?? ''}
              onValueChange={(value) =>
                apply({ agent: value, model: undefined, effort: undefined })
              }
              disabled={config.enabled || busy}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue
                  placeholder={t('components.native-chat.sidekick.pickAgent', 'Pick an agent')}
                />
              </SelectTrigger>
              <SelectContent>
                {AGENT_CATALOG.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {supportsLaunchPreferences && modelRows.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">
                {t('components.native-chat.sidekick.model', 'Model')}
              </span>
              <Select
                value={config.model ?? DEFAULT_VALUE}
                onValueChange={(value) =>
                  apply({ model: value === DEFAULT_VALUE ? undefined : value, effort: undefined })
                }
                disabled={config.enabled || busy}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_VALUE}>
                    {t('components.native-chat.sidekick.defaultModel', 'Agent default')}
                  </SelectItem>
                  {modelRows.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
          {supportsLaunchPreferences && (modelRow?.efforts.length ?? 0) > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">
                {t('components.native-chat.sidekick.effort', 'Effort')}
              </span>
              <Select
                value={config.effort ?? DEFAULT_VALUE}
                onValueChange={(value) =>
                  apply({ effort: value === DEFAULT_VALUE ? undefined : value })
                }
                disabled={config.enabled || busy}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_VALUE}>
                    {t('components.native-chat.sidekick.defaultEffort', 'Model default')}
                  </SelectItem>
                  {modelRow!.efforts.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
          {config.enabled ? (
            <p className="text-muted-foreground">
              {t(
                'components.native-chat.sidekick.running',
                'Running in this worktree. Turn off to release it.'
              )}
            </p>
          ) : null}
          {config.lastError ? (
            <p className="text-destructive" role="alert">
              {config.lastError}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

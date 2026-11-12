import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { AGENT_CATALOG } from '@/lib/agent-catalog/agent-catalog'
import { NativeChatComposerTabStrip } from '../composer/controls/NativeChatComposerTabStrip'
import { stopNativeChatSidekick } from './native-chat-sidekick'
import { useNativeChatSidekick } from './native-chat-sidekick-store'

/** The composer's top-edge strip while a Sidekick worker is on for this chat. */
export function NativeChatSidekickStrip({
  sessionId,
  target
}: {
  sessionId: string
  target: RuntimeClientTarget | null
}): React.JSX.Element | null {
  const t = useTranslate()
  const { config, update } = useNativeChatSidekick(sessionId)
  const [stopping, setStopping] = useState(false)

  if (!config.enabled) {
    return null
  }
  const agent = config.agent
    ? (AGENT_CATALOG.find((entry) => entry.id === config.agent)?.label ?? config.agent)
    : null
  const detail = [agent, config.model, config.effort].filter(Boolean).join(' · ')

  const stop = async () => {
    const dispatchId = config.dispatchId
    update({ enabled: false, dispatchId: undefined, runId: undefined, taskId: undefined })
    if (dispatchId && target) {
      setStopping(true)
      await stopNativeChatSidekick({ target, dispatchId }).catch(() => undefined)
      setStopping(false)
    }
  }

  return (
    <NativeChatComposerTabStrip data-native-chat-sidekick="">
      <Bot className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate py-1">
        {t('components.native-chat.sidekick.strip', 'Sidekick{{detail}}', {
          detail: detail ? ` · ${detail}` : ''
        })}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0"
        disabled={stopping}
        onClick={() => void stop()}
      >
        {t('components.native-chat.sidekick.turnOff', 'Turn off')}
      </Button>
    </NativeChatComposerTabStrip>
  )
}

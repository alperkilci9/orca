import { defineFixture } from '../../../component-fixtures/component-fixture'
import { NativeChatSidekickControl } from './NativeChatSidekickControl'
import { NativeChatSidekickStrip } from './NativeChatSidekickStrip'
import { writeNativeChatSidekick } from './native-chat-sidekick-store'

const SESSION_ON = 'fixture-sidekick-on'
const SESSION_OFF = 'fixture-sidekick-off'

writeNativeChatSidekick(SESSION_ON, {
  enabled: true,
  agent: 'codex',
  model: 'gpt-5.4',
  effort: 'high',
  dispatchId: 'disp_fixture'
})
writeNativeChatSidekick(SESSION_OFF, { enabled: false })

function surface(children: React.ReactNode) {
  return (
    <div className="native-chat-appearance bg-background py-3">
      {children}
      <div className="px-3 pt-2 sm:px-4">
        <div className="mx-auto h-20 w-full max-w-(--chat-content-max-width) rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Ask anything, @ to mention files, / for commands
        </div>
      </div>
    </div>
  )
}

export const sidekickOff = defineFixture({
  width: 640,
  render: () =>
    surface(
      <div className="mx-auto flex w-full max-w-(--chat-content-max-width) justify-end px-4">
        <NativeChatSidekickControl
          sessionId={SESSION_OFF}
          target={{ kind: 'local' }}
          leadAgent="claude"
        />
      </div>
    )
})

export const sidekickOn = defineFixture({
  width: 640,
  render: () =>
    surface(
      <>
        <NativeChatSidekickStrip sessionId={SESSION_ON} target={{ kind: 'local' }} />
        <div className="mx-auto flex w-full max-w-(--chat-content-max-width) justify-end px-4">
          <NativeChatSidekickControl
            sessionId={SESSION_ON}
            target={{ kind: 'local' }}
            leadAgent="claude"
          />
        </div>
      </>
    )
})

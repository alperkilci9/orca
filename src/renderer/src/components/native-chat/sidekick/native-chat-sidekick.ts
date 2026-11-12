import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../../../shared/orca-session-address-prefix'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'

/** Per-chat Sidekick configuration; the worker fields appear once a start lands. */
export type NativeChatSidekickConfig = {
  enabled: boolean
  agent?: string
  model?: string
  effort?: string
  /** The live sidekick worker's Dispatch, set by a successful start, cleared on stop. */
  dispatchId?: string
  runId?: string
  taskId?: string
  /** The last start/stop failure, shown beside the control. */
  lastError?: string
}

export function nativeChatSidekickSpec(): string {
  return [
    'You are the SIDEKICK agent for the conversation that dispatched you.',
    'Your role: short consultations for your coordinator — a second opinion,',
    'a review of a change, an alternative approach, a fact check.',
    '',
    'First action, exactly once: report readiness with worker_done',
    '(outcome succeeded, subject "Sidekick online"). Name your Dispatch ID',
    'and agent in the body so the coordinator can address you.',
    '',
    'Then idle. Every later message to your Dispatch is a consultation:',
    'answer it yourself and put the answer in your worker_done body.',
    'Do not edit files unless the consultation explicitly asks for it.'
  ].join('\n')
}

export type NativeChatSidekickStartReceipt = {
  dispatchId?: string
  runId?: string
  taskId?: string
}

export async function startNativeChatSidekick(args: {
  target: RuntimeClientTarget
  sessionId: string
  agent: string
  model?: string
  effort?: string
}): Promise<NativeChatSidekickStartReceipt> {
  return callRuntimeRpc<NativeChatSidekickStartReceipt>(args.target, 'orchestration.workerStart', {
    from: `${ORCA_SESSION_ADDRESS_PREFIX}${args.sessionId}`,
    worktree: 'current',
    agent: args.agent,
    ...(args.model ? { model: args.model } : {}),
    ...(args.effort ? { effort: args.effort } : {}),
    name: 'sidekick',
    spec: nativeChatSidekickSpec()
  })
}

export async function stopNativeChatSidekick(args: {
  target: RuntimeClientTarget
  dispatchId: string
}): Promise<unknown> {
  return callRuntimeRpc(args.target, 'orchestration.workerStop', { dispatch: args.dispatchId })
}

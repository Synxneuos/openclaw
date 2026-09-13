import type { ReplyPayload } from "../types.js";
import { admittedSessionSettingsRestrictRuntime } from "./dispatch-from-config.events.js";
import type { PrepareDispatchOperationReadyState } from "./dispatch-from-config.prepare-operation.js";
import type { InternalGetReplyOptions } from "./get-reply.types.js";
import type { ReplyDispatchKind } from "./reply-dispatcher.types.js";

const RESTRICTED_RUNTIME_TAKEOVER_ERROR =
  "This session's bound runtime cannot enforce its permission or tool policy; use an embedded runtime for this restricted conversation.";

export function runtimeTakeoverHooksAllowed(
  settings: InternalGetReplyOptions["admittedSessionSettings"],
): boolean {
  return !admittedSessionSettingsRestrictRuntime(settings);
}

export async function maybeRefuseRestrictedRuntimeTakeover(params: {
  state: PrepareDispatchOperationReadyState;
  sendFinalPayload: (
    payload: ReplyPayload,
    options: { abortSignal?: AbortSignal; deliveryId: string },
  ) => Promise<{ queuedFinal: boolean; routedFinalCount: number }>;
}): Promise<{ queuedFinal: boolean; counts: Record<ReplyDispatchKind, number> } | undefined> {
  const { state } = params;
  if (
    state.dispatchKind !== "acp" ||
    runtimeTakeoverHooksAllowed(state.params.replyOptions?.admittedSessionSettings)
  ) {
    return undefined;
  }
  const refusal = state.suppressDelivery
    ? { queuedFinal: false, routedFinalCount: 0 }
    : await params.sendFinalPayload(
        { text: RESTRICTED_RUNTIME_TAKEOVER_ERROR, isError: true },
        {
          abortSignal: state.getPreDispatchAbortSignal(),
          deliveryId: "restricted-runtime-takeover",
        },
      );
  const counts = state.dispatcher.getQueuedCounts();
  counts.final += refusal.routedFinalCount;
  state.recordProcessed("error", {
    reason: "restricted_runtime_takeover",
    error: RESTRICTED_RUNTIME_TAKEOVER_ERROR,
  });
  state.markIdle("message_completed");
  state.commitInboundDedupeIfClaimed();
  state.completeDispatchReplyOperation();
  return { queuedFinal: refusal.queuedFinal, counts };
}

export const ACP_DISPATCH_TAKEOVER_FAILED_ERROR = "ACP turn failed before completion.";

export async function maybeRefuseUncompletedAcpDispatchTakeover(params: {
  state: PrepareDispatchOperationReadyState;
  sendFinalPayload: (
    payload: ReplyPayload,
    options: { abortSignal?: AbortSignal; deliveryId: string },
  ) => Promise<{ queuedFinal: boolean; routedFinalCount: number }>;
}): Promise<{ queuedFinal: boolean; counts: Record<ReplyDispatchKind, number> } | undefined> {
  const { state } = params;
  if (state.dispatchKind !== "acp") {
    return undefined;
  }
  const refusal = state.suppressDelivery
    ? { queuedFinal: false, routedFinalCount: 0 }
    : await params.sendFinalPayload(
        { text: ACP_DISPATCH_TAKEOVER_FAILED_ERROR, isError: true },
        {
          abortSignal: state.getPreDispatchAbortSignal(),
          deliveryId: "acp-takeover-failed",
        },
      );
  const counts = state.dispatcher.getQueuedCounts();
  counts.final += refusal.routedFinalCount;
  state.recordProcessed("error", {
    reason: "acp_takeover_failed",
    error: ACP_DISPATCH_TAKEOVER_FAILED_ERROR,
  });
  state.markIdle("message_completed");
  state.commitInboundDedupeIfClaimed();
  state.completeDispatchReplyOperation();
  return { queuedFinal: refusal.queuedFinal, counts };
}

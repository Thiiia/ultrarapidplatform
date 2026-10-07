export class PlayerRunOutcomeBarrier<TAction> {
  private pendingAttemptId: string | null = null;
  private deferredAction: { attemptId: string; action: TAction } | null = null;

  begin(attemptId: string | null | undefined) {
    this.pendingAttemptId = attemptId || null;
    this.deferredAction = null;
  }

  defer(attemptId: string | null | undefined, action: TAction) {
    if (!attemptId || attemptId !== this.pendingAttemptId) return false;

    // Keep the first terminal action. For example, Unity's delayed fallback
    // exit must not replace a Retry already waiting for the outcome save.
    this.deferredAction ??= { attemptId, action };
    return true;
  }

  settle(attemptId: string | null | undefined): TAction | null {
    if (!attemptId || attemptId !== this.pendingAttemptId) return null;

    this.pendingAttemptId = null;
    const deferred = this.deferredAction;
    this.deferredAction = null;
    return deferred?.attemptId === attemptId ? deferred.action : null;
  }
}

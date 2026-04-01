mergeInto(LibraryManager.library, {
  UltraRapidShellNotifyAuthEvent: function (statePtr, messagePtr) {
    var state = statePtr ? UTF8ToString(statePtr) : "";
    var message = messagePtr ? UTF8ToString(messagePtr) : "";

    if (typeof window === "undefined") {
      return;
    }

    if (!window.UltraRapidShell || typeof window.UltraRapidShell.onUnityAuthEvent !== "function") {
      return;
    }

    window.UltraRapidShell.onUnityAuthEvent(state, message);
  }
});

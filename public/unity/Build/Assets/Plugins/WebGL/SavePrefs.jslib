mergeInto(LibraryManager.library, {
  SaveWebGLPrefs: function() {
    if(typeof(Storage) !== "undefined") {
      try {
        window.dispatchEvent(new Event('beforeunload'));
        console.log("Prefs force-saved");
      } catch(e) {
        console.log("Error saving prefs", e);
      }
    }
  },

  unity_resumeAudioContext: function() {
    try {
      var ctx = (typeof Module !== "undefined" && Module && Module.SDL2)
        ? Module.SDL2.audioContext
        : null;

      if (ctx && typeof ctx.resume === "function" && ctx.state === "suspended") {
        ctx.resume();
      }
    } catch (e) {
      console.log("Error resuming audio context", e);
    }
  }
});

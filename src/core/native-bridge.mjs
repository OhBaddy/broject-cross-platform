import { normalizeState, toPersistedState } from "./workspace-store.mjs";

export function createNativeBridge(invoke = null, fallbackStore = null) {
  const nativeInvoke = typeof invoke === "function" ? invoke : null;
  return {
    async load() {
      if (nativeInvoke) {
        const result = await nativeInvoke("load_workspace");
        const state = normalizeState(result?.state ?? result);
        return { state, recoveryMessage: result?.recoveryMessage ?? null };
      }
      if (!fallbackStore) throw new Error("Storage locale non disponibile.");
      return fallbackStore.load();
    },

    async save(state) {
      if (nativeInvoke) {
        return nativeInvoke("save_workspace", { stateJson: JSON.stringify(toPersistedState(state)) });
      }
      if (!fallbackStore) throw new Error("Storage locale non disponibile.");
      return fallbackStore.save(state);
    },

    async saveReport(bytes, defaultFileName, dialogTitle = "Esporta report") {
      if (nativeInvoke) {
        const values = bytes instanceof Uint8Array ? [...bytes] : [...new Uint8Array(bytes)];
        return nativeInvoke("save_report", { defaultFileName, dialogTitle, bytes: values });
      }
      return { saved: false, native: false };
    },

    async openReport(path) {
      if (nativeInvoke) return nativeInvoke("open_report", { path });
      return { opened: false, native: false };
    },

    async logError(error) {
      const message = String(error ?? "Errore inatteso");
      if (nativeInvoke) return nativeInvoke("log_error", { error: message });
      return { logged: false, native: false };
    }
  };
}

export function getGlobalNativeInvoke(root = globalThis) {
  return typeof root.window?.__TAURI_INTERNALS__?.invoke === "function"
    ? root.window.__TAURI_INTERNALS__.invoke.bind(root.window.__TAURI_INTERNALS__)
    : null;
}

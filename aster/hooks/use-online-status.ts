import { useEffect, useState, useSyncExternalStore } from "react";

const RECONNECTED_DISPLAY_MS = 3000;

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): { isOnline: boolean; justReconnected: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handleOnline = () => {
      setJustReconnected(true);
      reconnectTimer = setTimeout(() => setJustReconnected(false), RECONNECTED_DISPLAY_MS);
    };

    const handleOffline = () => {
      setJustReconnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}

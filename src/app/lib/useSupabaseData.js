import { useCallback, useEffect, useRef, useState } from "react";

function useSupabaseData(loader, deps = [], options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const realtimeTimer = useRef(null);
  const { pauseRefresh = false, refreshInterval = 10000 } = options;

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const nextData = await loader();
      setData(nextData || []);
    } catch (err) {
      setError(err.message || "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (pauseRefresh || !refreshInterval) return undefined;
    const fallbackRefresh = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        reload({ silent: true });
      }
    }, refreshInterval);
    return () => clearInterval(fallbackRefresh);
  }, [pauseRefresh, refreshInterval, reload]);

  useEffect(() => {
    if (pauseRefresh) return undefined;
    const refreshFromRealtime = () => {
      clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => reload({ silent: true }), 250);
    };
    window.addEventListener("nelpac:data-changed", refreshFromRealtime);
    return () => {
      clearTimeout(realtimeTimer.current);
      window.removeEventListener("nelpac:data-changed", refreshFromRealtime);
    };
  }, [pauseRefresh, reload]);

  return { data, loading, error, reload, setData };
}

export {
  useSupabaseData,
};

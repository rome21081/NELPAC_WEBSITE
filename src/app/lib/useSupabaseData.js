import { useCallback, useEffect, useRef, useState } from "react";

function useSupabaseData(loader, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const realtimeTimer = useRef(null);

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
    const fallbackRefresh = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        reload({ silent: true });
      }
    }, 10000);
    return () => clearInterval(fallbackRefresh);
  }, [reload]);

  useEffect(() => {
    const refreshFromRealtime = () => {
      clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => reload({ silent: true }), 250);
    };
    window.addEventListener("nelpac:data-changed", refreshFromRealtime);
    return () => {
      clearTimeout(realtimeTimer.current);
      window.removeEventListener("nelpac:data-changed", refreshFromRealtime);
    };
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export {
  useSupabaseData,
};

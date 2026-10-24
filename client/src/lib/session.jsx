import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const SessionContext = createContext(null);

// Holds the logged-in user, their profile, the shared vocabularies (/api/meta)
// and a toast helper, so every page can reach them.
export function SessionProvider({ children }) {
  const [session, setSession] = useState({ user: null, profile: null });
  const [meta, setMeta] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const refresh = useCallback(async () => {
    const { user, profile } = await api('/api/me');
    setSession({ user, profile: profile ?? null });
    return { user, profile };
  }, []);

  const notify = useCallback((message, isError = false) => {
    setToast({ message, isError });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Wait for both meta and the session before rendering, so pages that
  // redirect logged-out users don't fire before we know who's logged in.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([api('/api/meta').then(setMeta), refresh()])
      .then(() => setReady(true))
      .catch((e) => notify(e.message, true));
  }, [refresh, notify]);

  if (!ready) return null;
  return (
    <SessionContext.Provider value={{ ...session, meta, refresh, notify }}>
      {children}
      {toast && <div className={`toast${toast.isError ? ' err' : ''}`} role="status">{toast.message}</div>}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

// Loads data for a page and re-runs when `deps` change.
export function useLoad(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

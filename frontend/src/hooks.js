import { useCallback, useEffect, useState } from 'react';

// Minimal data-loading hook: { data, error, loading, reload }.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState({ data: null, error: error.message, loading: false })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

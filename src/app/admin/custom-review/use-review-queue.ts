'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { customReviewModel } from '@/models/custom-review';
import { getApiErrorMessage } from '@/lib/api-error';
import { searchTerm } from '@/lib/custom-review';
import type { ReviewQueueResponse, ReviewStatus } from '@/types/custom-review';

export type QueueFilter = ReviewStatus | 'all';

interface Loaded {
  key: string;
  data: ReviewQueueResponse | null;
  error: string | null;
}

/** The queue rail's data: status filter, a debounced search and the counts per status. */
export function useReviewQueue() {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ key: '', data: null, error: null });

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const { term, fromFile } = searchTerm(debounced);
  const key = `${filter}|${term}|${tick}`;

  useEffect(() => {
    const controller = new AbortController();
    customReviewModel
      .list({ status: filter === 'all' ? undefined : filter, q: term || undefined }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        // No stale rows or counts beside the error: the rail shows the banner and "–".
        setLoaded({ key, data: null, error: getApiErrorMessage(err) });
      });
    return () => controller.abort();
  }, [filter, term, key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return {
    filter,
    setFilter,
    query,
    setQuery,
    term,
    fromFile,
    data: loaded.data,
    loading: loaded.key !== key,
    error: loaded.key === key ? loaded.error : null,
    reload,
  };
}

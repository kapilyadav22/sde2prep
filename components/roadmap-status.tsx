'use client';

import { useEffect, useState } from 'react';
import { isRoadmapStatus, roadmapStatuses, roadmapStorageKey } from '@/lib/hld-roadmap.mjs';
import styles from './roadmap-status.module.css';

export function RoadmapStatus({ problemKey, title, initialStatus }: { problemKey: string; title: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const storageKey = roadmapStorageKey(problemKey);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setStatus(isRoadmapStatus(saved) ? saved! : initialStatus);
    } catch { /* The control still works when browser storage is unavailable. */ }
    setReady(true);
    const update = (event: StorageEvent) => {
      if (event.key === storageKey) setStatus(isRoadmapStatus(event.newValue) ? event.newValue! : initialStatus);
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [storageKey, initialStatus]);

  function change(value: string) {
    if (!isRoadmapStatus(value)) return;
    setStatus(value);
    try {
      localStorage.setItem(storageKey, value);
      setFailed(false);
      setMessage(`${title}: ${value}. Saved in this browser.`);
    } catch {
      setFailed(true);
      setMessage('This change could not be saved in this browser.');
    }
  }

  return <div className={styles.control} data-source-chrome="true">
    <select className={styles.select} data-status={status.toLowerCase().replaceAll(' ', '-')} aria-label={`${title} status`} aria-describedby="hld-roadmap-help" disabled={!ready} value={status} onChange={event => change(event.target.value)}>
      {roadmapStatuses.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
    <span className={failed ? styles.error : styles.srOnly} role={failed ? 'alert' : 'status'}>{message}</span>
  </div>;
}

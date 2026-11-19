'use client';

import { useSyncExternalStore } from 'react';
import { isOnline, subscribeOnline } from '@/offline/network';
import { emptyOutbox, outboxSnapshot, subscribeOutbox } from '@/offline/outbox';
import { lastSent, needsLogin, sending } from '@/offline/sync';

/** Plan v18: can the phone reach the shop's server right now? (Server render: yes.) */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}

/** Every sale saved on this phone, oldest first (all people; filter by `recordedBy`). */
export function useOutbox() {
  return useSyncExternalStore(subscribeOutbox, outboxSnapshot, emptyOutbox);
}

export function useSending(): boolean {
  return useSyncExternalStore(sending.subscribe, sending.get, () => false);
}

export function useNeedsLogin(): boolean {
  return useSyncExternalStore(needsLogin.subscribe, needsLogin.get, () => false);
}

export function useLastSent() {
  return useSyncExternalStore(lastSent.subscribe, lastSent.get, () => null);
}

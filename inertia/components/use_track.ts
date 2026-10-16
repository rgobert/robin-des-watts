import { useEffect } from 'react'

type Props = Record<string, string | number | boolean>

const sentOnce = new Set<string>()

function xsrfToken() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/**
 * Sends a tracking event to the live BO (POST /evenements).
 * Fire and forget: tracking never blocks or breaks the demo path.
 */
export function track(type: string, props: Props = {}) {
  fetch('/evenements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    body: JSON.stringify({ type, props }),
  }).catch(() => {})
}

/** Sends the event once per visit (survives StrictMode double mounts). */
export function trackOnce(key: string, type: string, props: Props = {}) {
  if (sentOnce.has(key)) return
  sentOnce.add(key)
  track(type, props)
}

export function useTrackOnce(key: string, type: string, props: Props = {}) {
  useEffect(() => {
    trackOnce(key, type, props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

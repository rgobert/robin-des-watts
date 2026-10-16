import { useCallback, useState } from 'react'

/** Simule une latence réseau pour démontrer les états de chargement avec des mocks. */
export function fakeFetch<T>(data: T, ms = 2400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

const safeGet = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const safeSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : on garde l'état en mémoire */
  }
}

/** Vrai tant que l'action `key` n'a pas été marquée vue. Pour coach marks et tutos « une seule fois ». */
export function useOnce(key: string): [boolean, () => void, () => void] {
  const storageKey = `kit:once:${key}`
  const [pending, setPending] = useState(() => safeGet(storageKey) !== '1')
  const markDone = useCallback(() => {
    safeSet(storageKey, '1')
    setPending(false)
  }, [storageKey])
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      /* rien */
    }
    setPending(true)
  }, [storageKey])
  return [pending, markDone, reset]
}

export const formatEuro = (v: number, decimals = 0) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

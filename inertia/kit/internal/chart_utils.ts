import { useLayoutEffect, useRef, useState } from 'react'

/*
 * Outils partagés des graphiques internes (SVG maison, zéro dépendance).
 * Couleurs : uniquement des tokens du kit (var(--color-*)) ; les teintes manquantes passent par color-mix.
 */

/** Largeur réelle d'un conteneur (ResizeObserver) : le SVG est dessiné en px vrais, le texte ne se déforme jamais. */
export function useElementWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.clientWidth || fallback)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.round(w))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, width] as const
}

/** Graduations « rondes » (1, 2, 2,5, 5 × 10^n) couvrant [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0]
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

export const scaleLinear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const fmtInt = (v: number) => nf0.format(Math.round(v))
export const fmtPct = (v: number, decimals = 1) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)} %`
export const fmtSignedPct = (v: number, decimals = 1) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtPct(Math.abs(v), decimals)}`

/** 1 284 · 12,9 k · 1,05 M (avec suffixe optionnel, ex. « € »). */
export function fmtCompact(v: number, unit = '') {
  const a = Math.abs(v)
  const u = unit ? ` ${unit}` : ''
  if (a >= 1e6) return `${nf1.format(v / 1e6).replace(/,0$/, '')} M${unit}`
  if (a >= 1e4) return `${nf1.format(v / 1e3).replace(/,0$/, '')} k${unit}`
  return `${nf0.format(v)}${u}`
}

export const fmtEuroCompact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6)
    return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / 1e6)} M€`
  if (a >= 1e4) return `${nf0.format(v / 1e3)} k€`
  return `${nf0.format(v)} €`
}

const dShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const dMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' })

export const parseISODate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)
export const fmtDateShort = (iso: string) => dShort.format(parseISODate(iso))
export const fmtDateLong = (iso: string) => dLong.format(parseISODate(iso))
export const fmtMonth = (iso: string) => dMonth.format(parseISODate(iso))

/** Mélange d'un token avec la surface : la seule façon d'obtenir une teinte intermédiaire sans toucher tokens.css. */
export const tint = (token: string, pct: number, base = 'var(--color-surface)') =>
  `color-mix(in oklab, var(--color-${token}) ${Math.round(pct)}%, ${base})`

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export const daysBetweenIso = (a: string, b: string) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)

/**
 * Orange « attention » lisible : --color-warning seul fait 3,8:1 sur blanc (< 4,5:1 WCAG AA pour du texte).
 * Assombri vers l'encre sans toucher tokens.css : 5,6:1 sur surface, 4,8:1 sur surface-2.
 */
export const WARNING_TEXT = 'text-[color-mix(in_oklab,var(--color-warning)_75%,var(--color-ink))]'
export const WARNING_BG = 'bg-[color-mix(in_oklab,var(--color-warning)_75%,var(--color-ink))]'

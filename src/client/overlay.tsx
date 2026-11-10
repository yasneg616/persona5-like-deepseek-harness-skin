import { useEffect, useRef, useState } from 'react'
import { restoreCollage, syncCollage } from './collage.ts'
import { cutoutFor } from './cutouts.ts'
import { clearHeroType, clearNavLeaves, syncHeroType, syncNavLeaves, syncSideWidth } from './leaves.ts'
import { readViewSignals, resolveArchitectureLabel } from './title.ts'
import { NAV_DURATION_MS, REPLAY_DURATION_MS, createTransitionLayer, prefersReducedMotion } from './transition.ts'

function LetterLine({ word }: { word: string }) {
  const letters = cutoutFor(word)
  return (
    <div className="dsh-cc-line">
      {letters.map((letter, index) => (
        <span
          key={`${word}-${letter.c}-${index}`}
          className={`dsh-cc-letter dsh-cc-shape-${letter.shape}${letter.reverse ? ' is-reversed' : ''}`}
          aria-hidden="true"
          style={{
            ['--slot' as string]: `${letter.w}em`,
            ['--face' as string]: letter.face,
            ['--letter-size' as string]: `${letter.size}em`,
            ['--letter-x' as string]: String(letter.sx),
            ['--tilt' as string]: `${letter.rot}deg`,
            ['--lift' as string]: `${letter.y}em`,
            ['--paper-height' as string]: `${letter.h}em`,
          }}
        >
          <span className="dsh-cc-glyph">{letter.c}</span>
        </span>
      ))}
    </div>
  )
}

function LetterTiles({ state }: { state: string | null }) {
  return (
    <div className="dsh-cc-architecture" role="img" aria-label="DEEPSEEK HARNESS">
      <LetterLine word="DEEPSEEK" />
      <LetterLine word="HARNESS" />
      <i className="dsh-cc-tagline">CUT THE NOISE.</i>
      {state ? <span className="dsh-cc-state">{state}</span> : null}
    </div>
  )
}

function readLabel() {
  return resolveArchitectureLabel(readViewSignals(document))
}

/** Frame overlay: architectural type, non-blocking paper cut, replay control. */
export function CallingCardOverlay() {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(readLabel)

  useEffect(() => {
    const node = host.current
    const status = live.current
    if (node === null || status === null) return
    const layer = createTransitionLayer(document, window)
    node.appendChild(layer.root)
    const frame = document.querySelector('div:has(> [data-shell-overlay])')
    const field = node.querySelector('.dsh-cc-field')
    const ground = frame ? document.createElement('div') : null
    if (ground && frame) {
      ground.className = 'dsh-cc-ground'
      ground.setAttribute('aria-hidden', 'true')
      for (const name of ['sky', 'fault', 'stars', 'spine', 'tear']) {
        const layerNode = document.createElement('div')
        layerNode.className = `dsh-cc-${name}`
        ground.append(layerNode)
      }
      if (field) ground.append(field)
      frame.append(ground)
    }
    let current = readLabel().state ?? ''
    let primed = false
    const paint = (announce: boolean) => {
      const next = readLabel()
      syncNavLeaves(document)
      syncHeroType(document)
      syncSideWidth(document)
      syncCollage(document)
      setView((previous) => previous.state === next.state ? previous : next)
      if (!primed) {
        primed = true
        current = next.state ?? ''
        return
      }
      if ((next.state ?? '') === current) return
      current = next.state ?? ''
      if (!current) return
      layer.play(current, NAV_DURATION_MS)
      if (announce && !prefersReducedMotion(window)) status.textContent = `转场 ${next.text}`
    }
    paint(false)
    let settleHeadings = window.setTimeout(() => syncCollage(document), 560)
    const scheduleHeadings = () => {
      window.clearTimeout(settleHeadings)
      settleHeadings = window.setTimeout(() => syncCollage(document), 560)
    }
    const observer = new MutationObserver((records) => {
      paint(true)
      const relevant = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement
        return target?.closest('[data-chat-flow-kind="assistant-step"], [data-cc-hero-title], [data-cc-hero-tag], [data-conversation-scroll]') != null
      })
      if (relevant) scheduleHeadings()
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-current', 'aria-selected', 'data-row-key'],
    })
    const onResize = () => syncSideWidth(document)
    window.addEventListener('resize', onResize)
    const handle = frame?.querySelector('[data-side="sidebar"]')
    const handleObserver = new MutationObserver(() => syncSideWidth(document))
    if (handle) handleObserver.observe(handle, { attributes: true, attributeFilter: ['style'] })
    const replay = node.querySelector('button')
    const onReplay = () => {
      layer.play(current, REPLAY_DURATION_MS)
      status.textContent = prefersReducedMotion(window) ? '已跳过转场' : '重播转场'
    }
    replay?.addEventListener('click', onReplay)
    return () => {
      replay?.removeEventListener('click', onReplay)
      window.clearTimeout(settleHeadings)
      observer.disconnect()
      handleObserver.disconnect()
      window.removeEventListener('resize', onResize)
      if (field && field.parentElement !== node) node.insertBefore(field, node.firstChild)
      ground?.remove()
      clearNavLeaves(document)
      clearHeroType(document)
      restoreCollage(document)
      layer.dispose()
    }
  }, [])

  return (
    <div className="dsh-cc-overlay" ref={host}>
      <div className="dsh-cc-field">
        <LetterTiles state={view.state} />
      </div>
      <button type="button" className="dsh-cc-replay">
        重播转场 <span aria-hidden="true">↗</span>
      </button>
      <div className="dsh-cc-live" role="status" aria-live="polite" ref={live} />
    </div>
  )
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="dsh-cc-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#e60012" />
      <polygon points="16,3 19.6,12.2 29,13.2 21.8,19.6 23.8,29 16,24.2 8.2,29 10.2,19.6 3,13.2 12.4,12.2" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

export function BrandName() {
  return (
    <span className="dsh-cc-name">
      DSH <span>斩噪</span>
    </span>
  )
}

/** Replaces the blank-session fish with the original star. The host keeps the headline. */
export function HeroMark({ size = 34, className }: { size?: number, className?: string }) {
  return (
    <svg className={`dsh-cc-hero ${className ?? ''}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <polygon points="16,2 19.8,11.6 30,12.6 22.2,19.4 24.4,29.4 16,24.2 7.6,29.4 9.8,19.4 2,12.6 12.2,11.6" fill="none" stroke="#111" strokeWidth="1.7" />
      <polygon points="16,8 18.4,14.2 25,14.8 20,19.2 21.4,25.6 16,22.2 10.6,25.6 12,19.2 7,14.8 13.6,14.2" fill="none" stroke="#e60012" strokeWidth="1.4" />
    </svg>
  )
}

import { BrandMark, BrandName, CallingCardOverlay, HeroMark } from './overlay.tsx'
import { holdDarkColorScheme, installSkinStyle } from './dom.ts'
import { CALLING_CARD_SOURCE, CALLING_CARD_TOKENS, assertUnifiedTokens } from './tokens.ts'

export interface ThemeApi {
  overrideTokens(source: string, tokens: typeof CALLING_CARD_TOKENS): () => void
  getTheme?: () => unknown
}

export interface SlotRegisterOptions {
  name: string
  id: string
  order?: number
  priority?: number
}

export interface SlotsApi {
  register(options: SlotRegisterOptions, component: unknown): () => void
  inject?(key: string, callback: () => (() => void) | void): () => void
}

export interface SkinContext {
  theme: ThemeApi
  slots: SlotsApi
  effect(setup: () => (() => void) | void): () => void
  on?(event: string, listener: () => void): () => void
}

const OVERLAY_ID = 'dsh-calling-card-skin.architecture'
const MARK_ID = 'dsh-calling-card-skin.mark'
const NAME_ID = 'dsh-calling-card-skin.name'
const HERO_ID = 'dsh-calling-card-skin.hero'

function whenSlot(ctx: SkinContext, key: string, setup: () => (() => void) | void): void {
  if (typeof ctx.slots.inject === 'function') {
    ctx.slots.inject(key, setup)
    return
  }
  const stop = setup()
  if (typeof stop === 'function') ctx.effect(() => stop)
}

function registerBrand(ctx: SkinContext, name: string, id: string, component: unknown): () => void {
  try {
    return ctx.slots.register({ name, id, priority: -1 }, component)
  } catch (error) {
    console.warn(`[dsh-calling-card-skin] left ${name} to the occupant already registered`, error)
    return () => {}
  }
}

/**
 * Browser plugin body. Tokens, the scoped stylesheet, and slot contributions
 * are disposed with the Cordis fiber when the bundle is disabled or removed.
 */
export function apply(ctx: SkinContext, documentRef: Document = document, css = ''): void {
  assertUnifiedTokens(CALLING_CARD_TOKENS)
  ctx.effect(() => installSkinStyle(documentRef, css))
  ctx.effect(() => ctx.theme.overrideTokens(CALLING_CARD_SOURCE, CALLING_CARD_TOKENS))
  ctx.effect(() => {
    const release = holdDarkColorScheme(documentRef)
    const restamp = () => {
      documentRef.documentElement.style.colorScheme = 'dark'
    }
    const stopListen = ctx.on?.('theme/change', restamp)
    return () => {
      stopListen?.()
      release()
    }
  })
  whenSlot(ctx, 'shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: OVERLAY_ID,
    order: 12,
  }, CallingCardOverlay))
  whenSlot(ctx, 'sidebar.brand.mark', () => registerBrand(ctx, 'sidebar.brand.mark', MARK_ID, BrandMark))
  whenSlot(ctx, 'sidebar.brand.name', () => registerBrand(ctx, 'sidebar.brand.name', NAME_ID, BrandName))
  whenSlot(ctx, 'conversation.hero.brand.mark', () => registerBrand(ctx, 'conversation.hero.brand.mark', HERO_ID, HeroMark))
}

export const PLUGIN_NAME = 'dsh-calling-card-skin'
export const PLUGIN_INJECT = ['theme', 'slots'] as const

import skinCss from 'skin.css'
import { PLUGIN_INJECT, PLUGIN_NAME, apply as applySkin, type SkinContext } from './apply.ts'

export const name = PLUGIN_NAME
export const inject = [...PLUGIN_INJECT]

export function apply(ctx: SkinContext): void {
  applySkin(ctx, document, skinCss)
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>)
    window: Window & typeof globalThis
    getInternalVMContext(): object
  }
}

declare module 'semver' {
  export function satisfies(version: string, range: string, options?: { includePrerelease?: boolean }): boolean
}

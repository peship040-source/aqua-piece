// The app's local React type surface.
declare module 'react' {
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void]
  export function useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void
  export function useRef<T>(initial: T | null): { current: T | null }
}

declare module 'react-dom/client' {
  export function createRoot(container: Element): { render(element: import('react/jsx-runtime').JSX.Element): void }
}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element {}
    interface ElementChildrenAttribute { children: unknown }
    interface IntrinsicAttributes { key?: string | number }
    interface Attributes extends IntrinsicAttributes {
      children?: unknown
      className?: string
      id?: string
      role?: string
      style?: Record<string, string | number>
      'aria-label'?: string
      'aria-labelledby'?: string
      'aria-hidden'?: boolean | 'true' | 'false'
      'aria-busy'?: boolean
      'aria-valuenow'?: number
      'aria-valuemax'?: number
    }
    interface IntrinsicElements {
      main: Attributes
      header: Attributes
      h1: Attributes
      h2: Attributes
      p: Attributes
      dl: Attributes
      dt: Attributes
      dd: Attributes
      div: Attributes
      canvas: Attributes & { ref: { current: HTMLCanvasElement | null } }
      span: Attributes
      strong: Attributes
      small: Attributes
      i: Attributes
      section: Attributes
      dialog: Attributes & { ref: { current: HTMLDialogElement | null } }
      footer: Attributes
      button: Attributes & {
        type: 'button'
        onClick: () => void
        disabled?: boolean
      }
    }
  }
}

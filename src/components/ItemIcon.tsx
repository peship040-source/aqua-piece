const artwork = {
  'seaglass-green': (
    <>
      <path fill="#4cb793" d="M8 35 18 15q3-6 10-5l19 4q6 1 8 7l3 15q1 6-4 9L35 55q-5 3-10 0L11 46q-6-4-3-11Z" />
      <path fill="#85d9b1" d="m13 36 9-18q2-4 6-3l18 4q4 1 5 5l1 9q0 3-3 5L29 48q-3 1-6-1l-9-6q-3-2-1-5Z" />
      <path fill="#c0f4d5" d="M21 28q-2-1-1-3l3-6q1-2 4-1l10 2q3 1 2 3t-4 2l-8-1-3 4q-1 1-3 0Z" />
    </>
  ),
  'seaglass-blue': (
    <>
      <path fill="#367ec7" d="M26 10q4-6 10 0c5 5 17 19 17 28a21 21 0 0 1-42 0c0-9 10-23 15-28Z" />
      <path fill="#539edb" d="M28 13q3-4 7 0c5 6 11 16 11 22a15 15 0 0 1-30 0c0-7 7-17 12-22Z" />
      <path fill="#a2d9f6" d="M23 33c-4-1 1-10 5-13 3-2 6 1 3 4-4 4-4 10-8 9Z" />
    </>
  ),
  'coral-shell': (
    <>
      <path fill="#e88477" d="M53 33c3 9 4 17-3 21-5 3-11 0-13-4C21 55 8 46 8 32 8 18 18 9 32 9c13 0 25 9 21 24Z" />
      <path fill="#ffb49a" d="M48 31c0 11-9 17-19 17-10 0-17-7-17-16 0-11 8-19 19-19 10 0 17 8 17 18Z" />
      <path fill="none" stroke="#cd6c68" strokeWidth="3.5" strokeLinecap="round"
        d="M44 36c-4 8-16 11-22 4-5-5-3-14 4-17 5-2 11 1 11 6 0 4-4 7-8 5" />
    </>
  ),
  starfish: (
    <>
      <path fill="#f6a252" d="M28 9q4-7 8 0l5 13 14 1q8 1 3 7L47 40l3 14q1 7-6 4l-12-8-12 8q-7 3-6-4l3-14L6 30q-5-6 3-7l14-1Z" />
      <circle fill="#ffdf9a" cx="32" cy="32" r="4" />
      <path fill="none" stroke="#ffdf9a" strokeWidth="4" strokeLinecap="round"
        d="M32 16h.1M16 29h.1M47 29h.1M24 45h.1M40 45h.1" />
    </>
  ),
  'pearl-oyster': (
    <>
      <path fill="#b5afc8" d="M30 15c9-8 25-2 24 9-1 8-10 18-22 22C19 41 9 33 8 25 6 14 22 8 30 15Z" />
      <path fill="#8986a9" d="M58 36c0 10-11 20-26 20S6 47 6 37c0-7 9-13 17-10l9 3 8-3c9-3 18 2 18 9Z" />
      <circle fill="#fff8f5" cx="32" cy="35" r="8" />
    </>
  ),
  seahorse: (
    <>
      <path fill="#82dec6" d="M31 29c-11-6-15 1-10 9 3 4 8 4 13 2Z" />
      <path fill="#3eadad" d="M23 14q4-9 14-9c10 0 15 8 14 17-1 7-7 12-10 18-2 4 0 7 2 7q4 0 4-3c0-3 6-4 7 1 1 8-5 14-12 14-10 0-15-8-13-17 1-7 7-12 8-19l-13 3q-7 1-8-4t7-8Z" />
      <circle fill="#194658" cx="32" cy="14" r="2.4" />
    </>
  ),
  jellyfish: (
    <>
      <path fill="none" stroke="#e395ba" strokeWidth="4.5" strokeLinecap="round"
        d="M20 31c-9 8 5 12-1 22M31 33c-6 8 8 13 2 24M43 31c9 7-4 11 3 21" />
      <path fill="#f3a9d0" d="M8 29C8 17 19 7 32 7s24 10 24 22c0 5-4 7-8 5-3-1-5 1-8 2-4 2-6-2-9-2s-6 4-10 2c-3-1-4-3-7-2-3 1-6-1-6-5Z" />
      <path fill="none" stroke="#ffdeeb" strokeWidth="3.5" strokeLinecap="round" d="M17 24q3-7 12-9" />
    </>
  ),
  'coral-piece': (
    <>
      <path fill="none" stroke="#e87d9b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
        d="M31 53c4-15 2-29-1-43m3 24c10-2 16-11 17-20M33 44C19 44 12 36 9 29m18 13c-7-7-7-16-8-22m22 11c6 2 11 0 15-4" />
      <path fill="#c75d87" d="M21 53q3-5 11-5t13 5q3 6-3 6H24q-7 0-3-6Z" />
      <path fill="none" stroke="#ffafbf" strokeWidth="2.5" strokeLinecap="round" d="m30 10 2 11M11 31q4 6 8 7" />
    </>
  ),
  'tropical-fish': (
    <>
      <path fill="#4f9bd0" d="m39 32 15-13q5-3 5 3v20q0 6-5 3L39 32ZM19 23q5-13 13-12l9 13-7 3Z" />
      <path fill="#ffd36c" d="M5 32c0-6 12-16 22-16 11 0 20 8 23 16-3 8-12 16-23 16C17 48 5 38 5 32Z" />
      <path fill="#4f9bd0" d="M29 16q8 1 12 5c-6 7-6 15 0 22q-4 4-12 5c-6-9-6-23 0-32Z" />
      <circle fill="#194658" cx="15" cy="30" r="2.5" />
    </>
  ),
  'sea-turtle': (
    <>
      <path fill="#76c5a2" d="M39 23c1-5 3-13 10-14 5-1 8 3 7 7-1 6-7 10-13 12Zm0 18c1 5 3 13 10 14 5 1 8-3 7-7-1-6-7-10-13-12ZM23 21C16 13 6 16 9 23c2 4 7 6 12 6Zm0 22C16 51 6 48 9 41c2-4 7-6 12-6Z" />
      <ellipse fill="#76c5a2" cx="53" cy="32" rx="8" ry="7" />
      <ellipse fill="#368c76" cx="30" cy="32" rx="19" ry="16" />
      <path fill="#a6d894" d="m30 21 9 6v10l-9 6-9-6V27Z" />
    </>
  ),
}

export function ItemIcon({ itemId, owned, size, label }: {
  itemId: string; owned: boolean; size: number; label?: string
}) {
  if (!Object.hasOwn(artwork, itemId)) return null

  return (
    <svg
      className={owned ? 'item-icon' : 'item-icon item-icon-silhouette'}
      viewBox="0 0 64 64" width={size} height={size}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      {artwork[itemId as keyof typeof artwork]}
    </svg>
  )
}

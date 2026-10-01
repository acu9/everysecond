/**
 * The viewer's own collection: photographs they have saved.
 *
 * Kept in localStorage rather than on a server because there is no account to
 * hang it on — the archive is a static site, and a saved picture is a note the
 * viewer makes to themselves. That has two consequences this module has to
 * absorb for its callers:
 *
 * - Storage can simply not be there. Private browsing, a blocked-cookies
 *   setting or a quota refusal all throw on access rather than returning null,
 *   so every touch of it is guarded. When it is unavailable the collection
 *   still works for the length of the visit, backed by the in-memory copy.
 * - The same site may be open in another tab, editing the same list. `storage`
 *   events carry those edits back, so both tabs agree without a reload.
 */

const STORAGE_KEY = 'every-second:collection'

/**
 * Told that the collection changed. The state itself is read back through the
 * functions below, so a listener is never handed a snapshot it might then hold
 * on to past the next edit.
 */
type Listener = () => void

const listeners = new Set<Listener>()

/**
 * Authoritative in-memory copy. Reads go through this so a page that cannot
 * reach storage still behaves; writes push it out and let the write fail.
 */
let ids: string[] = load()

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    // Anything could be sitting under that key — another version of this site,
    // or a hand-edited value. Keep only what is actually a list of ids.
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []
  }
  catch {
    return []
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }
  catch {
    // Out of quota, or storage denied outright. The in-memory list is still
    // correct for this visit, which is the most that can be honoured.
  }
}

function announce(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function isSaved(id: string): boolean {
  return ids.includes(id)
}

export function savedCount(): number {
  return ids.length
}

/** Add or remove a photograph. Returns its state afterwards. */
export function toggleSaved(id: string): boolean {
  const next = !isSaved(id)
  // Newest first, so the collection reads in the order it was gathered.
  ids = next ? [id, ...ids] : ids.filter(saved => saved !== id)

  save()
  announce()
  return next
}

/** Subscribe to changes, from this tab or another one. Returns an unsubscribe. */
export function onCollectionChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) {
    return
  }
  ids = load()
  announce()
})

import manifest from './photos.json'

export interface Photo {
  /** Filename stem, e.g. "01". Joins the manifest to the imported image module. */
  id: string
  file: string
  width: number
  height: number
  aspect: number
  orientation: 'landscape' | 'portrait'
  capturedAt: string
  location: { city: string, country: string }
  exif: {
    body: string
    lens: string
    aperture: string
    shutter: string
    iso: number
  }
  tags: string[]
}

export const photos = manifest as Photo[]

export interface TagCount {
  name: string
  count: number
}

/**
 * Tag list for the filter panel, most frequent first. The synthetic `all` entry
 * leads the list the same way it does in the reference design.
 */
export function getTagCounts(list: Photo[] = photos): TagCount[] {
  const counts = new Map<string, number>()

  for (const photo of list) {
    for (const tag of photo.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const sorted = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return [{ name: 'all', count: list.length }, ...sorted]
}

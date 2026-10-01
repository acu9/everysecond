/**
 * Ribbon geometry.
 *
 * Every layout in the design — the tightly packed overview band, the spread-out
 * browse state, the local fan-out under the cursor — is the same isometric
 * stack with different spacing. So this module keeps one position function and
 * exposes the spacing as parameters; nothing here touches the DOM.
 *
 * Each frame sits on a single diagonal axis running up and to the right. A
 * photo's position is its scalar distance `u` along that axis, projected onto
 * the unit axis vector. Everything that moves a photo — scroll, mode change,
 * fan-out — just contributes to `u`.
 */

/** Rise over run of the stacking diagonal. Matches the reference implementation. */
export const STACK_SLOPE = 0.6

/**
 * Unit vector along the stacking axis, pointing up and to the right.
 * Y is negated because screen coordinates grow downwards.
 */
const denominator = Math.sqrt(1 + STACK_SLOPE * STACK_SLOPE)
export const AXIS = {
  x: 1 / denominator,
  y: -STACK_SLOPE / denominator,
} as const

/**
 * Angle of the stacking axis in degrees, for anything that has to lie *along*
 * the band rather than sit on it — the pooled shadows and the time axis. Derived
 * from AXIS rather than restated, so the slope stays stated once.
 */
export const AXIS_ANGLE = (Math.atan2(AXIS.y, AXIS.x) * 180) / Math.PI

/**
 * Unit normal to the stacking axis, pointing down and to the right — the
 * direction anything annotating the band is pushed clear of it.
 */
export const AXIS_NORMAL = {
  x: -AXIS.y,
  y: AXIS.x,
} as const

export type RibbonMode = 'ribbon' | 'browse' | 'detail'

/** The tunable spacing state. Every value here is lerped frame to frame. */
export interface RibbonParams {
  /** Distance along the axis between adjacent photos, in px. */
  gap: number
  /** Extra split pushed between the two halves either side of focus, in px. */
  groupGap: number
  /** Peak local spread added around the cursor, in px. */
  fanStrength: number
  /** How many photos the fan-out reaches on each side. */
  fanSpread: number
  /** Multiplier on a frame's rendered size. */
  frameScale: number
}

/**
 * Spacing targets per mode. The rAF loop eases between these, which is what
 * makes a mode change read as the whole band breathing open or shut.
 */
export const MODE_PARAMS: Record<RibbonMode, RibbonParams> = {
  // Overview: razor-thin slices, so 200 prints still read as a dense archive.
  // The fan is strong enough to part the band into two halves around the
  // cursor — a local bulge reads as a rendering wobble rather than an invitation.
  ribbon: { gap: 5, groupGap: 0, fanStrength: 120, fanSpread: 5, frameScale: 0.34 },
  // Browsing: photos readable individually, focus parted from its neighbours.
  browse: { gap: 52, groupGap: 130, fanStrength: 0, fanSpread: 6, frameScale: 0.62 },
  // Detail: neighbours close back up into dense blocks and are pushed well
  // clear of the photograph — the archive carrying on either side of the one
  // frame in hand, rather than a row of rivals competing with it.
  detail: { gap: 6, groupGap: 560, fanStrength: 0, fanSpread: 6, frameScale: 0.44 },
}

/**
 * Local spread around the cursor.
 *
 * tanh saturates, so photos near the cursor separate while everything beyond
 * the fan simply shifts by a constant — the band opens up locally without the
 * displacement accumulating along its whole length.
 */
export function fanOffset(distance: number, strength: number, spread: number): number {
  if (strength === 0) {
    return 0
  }
  return strength * Math.tanh(distance / spread)
}

export interface Jitter {
  x: number
  y: number
}

/**
 * Per-photo positional noise, keyed by index.
 *
 * Without this the stack is a perfectly regular comb, which reads as a machined
 * object rather than a pile of prints. Seeded so it stays put across re-renders.
 */
export function createJitter(count: number, amount: number, seed = 0x9E3779B9): Jitter[] {
  let state = seed >>> 0
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return Array.from({ length: count }, () => ({
    x: (random() - 0.5) * amount,
    y: (random() - 0.5) * amount,
  }))
}

export interface Position {
  x: number
  y: number
}

/**
 * Where photo `index` sits, in px relative to the centre of the stack.
 *
 * @param index       Photo's position in the (possibly filtered) list.
 * @param scrollPos   Fractional index currently centred. Fractional so momentum
 *                    scrolling glides instead of snapping photo to photo.
 * @param focusPos    Fractional index the cursor is over, or null when the
 *                    pointer is away and the band stays closed.
 * @param params      Current spacing state.
 * @param jitter      This photo's fixed positional noise.
 * @param fanStrength Effective spread, already scaled by how far the hover has
 *                    faded in — passed separately so the caller can ease the
 *                    fan open and shut without rebuilding `params`.
 */
export function positionAt(
  index: number,
  scrollPos: number,
  focusPos: number | null,
  params: RibbonParams,
  jitter: Jitter,
  fanStrength: number = params.fanStrength,
): Position {
  const distance = index - scrollPos

  let u = distance * params.gap

  // Split the stack either side of the focused photo. Uses distance from the
  // nearest whole index so the two halves part cleanly rather than drifting.
  if (params.groupGap !== 0 && Math.abs(distance) > 0.5) {
    u += Math.sign(distance) * params.groupGap
  }

  if (focusPos !== null) {
    u += fanOffset(index - focusPos, fanStrength, params.fanSpread)
  }

  return {
    x: u * AXIS.x + jitter.x,
    y: u * AXIS.y + jitter.y,
  }
}

/**
 * Invert the projection: turn a pointer position (relative to stack centre)
 * into a fractional photo index, so hovering anywhere along the band knows
 * which photos to fan apart.
 */
export function indexAtPoint(
  pointX: number,
  pointY: number,
  scrollPos: number,
  gap: number,
): number {
  // Project the point onto the axis to recover `u`, then undo the gap scaling.
  const u = pointX * AXIS.x + pointY * AXIS.y
  return scrollPos + u / gap
}

/** Exponential smoothing that behaves consistently regardless of frame rate. */
export function damp(current: number, target: number, smoothing: number, deltaMs: number): number {
  const factor = 1 - smoothing ** (deltaMs / 16.667)
  return current + (target - current) * factor
}

/** Clamp a fractional scroll position to the ends of the list. */
export function clampScroll(value: number, count: number): number {
  return Math.max(0, Math.min(count - 1, value))
}

export type TimeUnit = 'year' | 'month' | 'week' | 'day' | 'hour'

/** Coarse to fine. The finest that still yields a readable number of ticks wins. */
const TIME_UNITS: TimeUnit[] = ['year', 'month', 'week', 'day', 'hour']

export interface TimeMarker {
  /** Rank in the (filtered) list where this period starts. */
  rank: number
  /** Capture time of the photograph at that rank. */
  at: number
  /** Granularity the run of markers was cut at, so labels can match it. */
  unit: TimeUnit
}

/**
 * Bucket key for a timestamp. Local time throughout, because the labels are
 * formatted in local time too — bucketing in UTC would put the tick on a
 * different photograph than the one whose label changes.
 */
function bucketKey(time: number, unit: TimeUnit): number {
  const date = new Date(time)
  const year = date.getFullYear()

  switch (unit) {
    case 'year':
      return year
    case 'month':
      return year * 12 + date.getMonth()
    case 'week':
    case 'day': {
      // Days since the epoch by the *local* calendar date, so DST cannot shift
      // a photograph into its neighbour's day.
      const days = Date.UTC(year, date.getMonth(), date.getDate()) / 86_400_000
      // The epoch fell on a Thursday; +4 lands week boundaries on Mondays.
      return unit === 'day' ? days : Math.floor((days + 4) / 7)
    }
    case 'hour':
      return Date.UTC(year, date.getMonth(), date.getDate(), date.getHours()) / 3_600_000
  }
}

/** Ranks at which `unit` ticks over, first photograph of each bucket. */
function bucketStarts(times: number[], unit: TimeUnit): TimeMarker[] {
  const marks: TimeMarker[] = []
  let previous: number | null = null

  for (let rank = 0; rank < times.length; rank++) {
    const key = bucketKey(times[rank]!, unit)
    if (key !== previous) {
      previous = key
      marks.push({ rank, at: times[rank]!, unit })
    }
  }

  return marks
}

/**
 * Graduated marks along the band, one per period boundary.
 *
 * The granularity is chosen rather than fixed: a collection spanning years
 * wants year marks, a filtered series shot over one weekend wants hours, and
 * neither knows which it is in advance. So this walks from coarse to fine and
 * keeps the last granularity that still fits inside `maxMarkers` — the most
 * detail the band can carry without the labels turning into a ruler.
 *
 * `times` is in band order, which runs newest first; the mark therefore sits on
 * the most recent photograph of each period, at the end where that period
 * begins as you read along the band.
 */
export function timeMarkers(times: number[], maxMarkers = 6): TimeMarker[] {
  if (times.length === 0 || maxMarkers < 1) {
    return []
  }

  let chosen: TimeMarker[] = []

  for (const unit of TIME_UNITS) {
    const marks = bucketStarts(times, unit)
    if (marks.length > maxMarkers) {
      break
    }
    chosen = marks
  }

  if (chosen.length > 0) {
    return chosen
  }

  // Even the coarsest granularity overflows — an archive spanning more years
  // than there is room for ticks. Thin them evenly rather than dropping the
  // axis altogether or crowding one end of the band.
  const years = bucketStarts(times, 'year')
  const stride = Math.ceil(years.length / maxMarkers)
  return years.filter((_, i) => i % stride === 0)
}

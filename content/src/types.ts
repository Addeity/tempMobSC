/** A region of the recording, as fractions of the cropped frame: x, y, width, height. */
export type Rect = readonly [x: number, y: number, w: number, h: number];

export interface Step {
  /** When the step starts, in seconds of the finished film. */
  readonly t: number;
  readonly title: string;
  readonly body: string;
  /** Where the camera settles while this step plays. Omitted: the whole frame. */
  readonly focus?: Rect;
}

/** Something painted over the recording in every render, film and card alike. */
export type Mask =
  /** the Figma embed: replaced by a panel saying what plays there */
  | { readonly kind: 'figma-prototype'; readonly rect: Rect }
  /** a flat patch in the colour underneath, for text that must not show, during the given film seconds */
  | { readonly kind: 'cover'; readonly rect: Rect; readonly color: string; readonly during: ReadonlyArray<readonly [number, number]> };

export interface Workflow {
  readonly key: string;
  readonly title: string;
  readonly category: string;
  readonly lede: string;
  readonly note: string;
  /**
   * Where the clip sits in the source recording, in seconds. `cuts` are the
   * white page-change flashes dropped from it, relative to `start`.
   */
  readonly source: {
    readonly start: number;
    readonly end: number;
    readonly cuts: ReadonlyArray<readonly [number, number]>;
  };
  /** Playback rate of the film over the master: long clips are tightened, none are slowed. */
  readonly speed: number;
  readonly steps: readonly Step[];
  readonly masks?: readonly Mask[];
}

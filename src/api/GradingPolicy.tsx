export interface Mark {
  mark: string
  color: string // MUST be in R G B format (or a var that points to it)
  // actual number -> at least this ratio
  // null -> lowest possible ratio, but not NaN
  // undefined -> NaN
  ratioNeeded?: number | null
  gpaPoints?: number
  wgpaPoints?: number
}

export default class GradingPolicy {
  constructor(public markRules: Mark[]) {}

  public static mcps(): GradingPolicy {
    return new GradingPolicy([
      {
        mark: 'A',
        color: 'var(--c-scale-5)',
        ratioNeeded: 0.895,
        gpaPoints: 4.0,
        wgpaPoints: 5.0,
      },
      {
        mark: 'B',
        color: 'var(--c-scale-4)',
        ratioNeeded: 0.795,
        gpaPoints: 3.0,
        wgpaPoints: 4.0,
      },
      {
        mark: 'C',
        color: 'var(--c-scale-3)',
        ratioNeeded: 0.695,
        gpaPoints: 2.0,
        wgpaPoints: 3.0,
      },
      {
        mark: 'D',
        color: 'var(--c-scale-2)',
        ratioNeeded: 0.595,
        gpaPoints: 1.0,
        wgpaPoints: 1.0,
      },
      {
        mark: 'E',
        color: 'var(--c-scale-1)',
        ratioNeeded: null,
        gpaPoints: 0.0,
        wgpaPoints: 0.0,
      },
      {
        mark: 'N/A',
        color: 'var(--c-fg)',
      },
    ])
  }

  public getMark(ratio: number): Mark {
    return this.markRules.find(rule => (
      rule.ratioNeeded != null
        ? ratio >= rule.ratioNeeded
        : rule.ratioNeeded === null
          ? !isNaN(ratio)
          : true
    )) ?? {
      mark: 'N/A',
      color: 'var(--c-fg)',
    } satisfies Mark
  }
}
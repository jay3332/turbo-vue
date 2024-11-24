export interface Weight {
  name: string
  colloquial: string
  short: string
  weight: number // 0.0 to 1.0
}

export default class WeightingPolicy {
  weights: Map<string, Weight>

  constructor(weights: Weight[]) {
    this.weights = new Map(weights.map(weight => [weight.name, weight]))
  }

  public static mcps(): WeightingPolicy {
    return new this([
      { name: 'All Tasks / Assessments', colloquial: 'All Tasks', short: 'AT', weight: 0.9 },
      { name: 'Practice / Preparation', colloquial: 'Practice/Prep', short: 'PP', weight: 0.1 },
    ])
  }
}
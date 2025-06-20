export interface TrainedModel {
  id: string;
  name: string;
  version: string;
  accuracy: number;
  loss: number;
  created_at: string;
}

export interface ComparisonMetric {
  modelId: string;
  metric: string;
  value: number;
}

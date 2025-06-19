// Training utilities for safe metrics access
import type { Json } from '~/types/supabase-generated';

// Safe metric access functions
export function safeMetricValue(metrics: Json | null | undefined, key: string): number | null {
  if (!metrics || typeof metrics !== 'object' || metrics === null) return null;

  const metricsObj = metrics as Record<string, any>;
  const value = metricsObj[key];

  return typeof value === 'number' ? value : null;
}

export function safeMetricString(metrics: Json | null | undefined, key: string): string | null {
  if (!metrics || typeof metrics !== 'object' || metrics === null) return null;

  const metricsObj = metrics as Record<string, any>;
  const value = metricsObj[key];

  return typeof value === 'string' ? value : null;
}

export function safeMetricProperty(metrics: Json | null | undefined, key: string): any {
  if (!metrics || typeof metrics !== 'object' || metrics === null) return null;

  const metricsObj = metrics as Record<string, any>;
  return metricsObj[key] ?? null;
}

// Specific metric extractors
export function getLoss(metrics: Json | null | undefined): number | null {
  return safeMetricValue(metrics, 'loss');
}

export function getAccuracy(metrics: Json | null | undefined): number | null {
  return safeMetricValue(metrics, 'accuracy');
}

export function getValLoss(metrics: Json | null | undefined): number | null {
  return safeMetricValue(metrics, 'val_loss');
}

export function getEpoch(metrics: Json | null | undefined): number | null {
  return safeMetricValue(metrics, 'epoch');
}

export function getTotalEpochs(metrics: Json | null | undefined): number | null {
  return safeMetricValue(metrics, 'total_epochs');
}

export function getHistory(metrics: Json | null | undefined): any {
  return safeMetricProperty(metrics, 'history');
}

// Format training progress display
export function formatTrainingProgress(current: number | null, total: number | null): string {
  if (current === null || total === null) return 'N/A';
  return `${current}/${total}`;
}

// Calculate training progress percentage
export function calculateProgress(current: number | null, total: number | null): number {
  if (current === null || total === null || total === 0) return 0;
  return Math.round((current / total) * 100);
}

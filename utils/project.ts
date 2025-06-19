// Project utility functions with null safety
export function getProjectColor(type: string | null | undefined): string {
  if (!type) return 'grey';

  const colors: Record<string, string> = {
    cv: 'blue',
    nlp: 'green',
    classification: 'purple',
    regression: 'orange',
    clustering: 'pink',
    recommendation: 'teal',
    'time-series': 'indigo',
    custom: 'deep-orange',
  };

  return colors[type] || 'grey';
}

export function getProjectIcon(type: string | null | undefined): string {
  if (!type) return 'mdi-help-circle';

  const icons: Record<string, string> = {
    cv: 'mdi-eye',
    nlp: 'mdi-text',
    classification: 'mdi-sort',
    regression: 'mdi-chart-line',
    clustering: 'mdi-dots-hexagon',
    recommendation: 'mdi-star',
    'time-series': 'mdi-chart-timeline',
    custom: 'mdi-cog',
  };

  return icons[type] || 'mdi-help-circle';
}

export function getProjectTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown';

  const labels: Record<string, string> = {
    cv: 'Computer Vision',
    nlp: 'Natural Language Processing',
    classification: 'Classification',
    regression: 'Regression',
    clustering: 'Clustering',
    recommendation: 'Recommendation',
    'time-series': 'Time Series',
    custom: 'Custom',
  };

  return labels[type] || 'Unknown';
}

export function getStatusColor(status: string | null | undefined): string {
  if (!status) return 'grey';

  const colors: Record<string, string> = {
    active: 'green',
    inactive: 'grey',
    draft: 'orange',
    archived: 'blue-grey',
    error: 'red',
    running: 'blue',
    completed: 'green',
    failed: 'red',
    pending: 'orange',
    cancelled: 'grey',
    stopped: 'orange',
    deploying: 'blue',
    terminated: 'red',
  };

  return colors[status] || 'grey';
}

export function getStatusIcon(status: string | null | undefined): string {
  if (!status) return 'mdi-help-circle';

  const icons: Record<string, string> = {
    active: 'mdi-check-circle',
    inactive: 'mdi-pause-circle',
    draft: 'mdi-pencil-circle',
    archived: 'mdi-archive',
    error: 'mdi-alert-circle',
    running: 'mdi-play-circle',
    completed: 'mdi-check-circle',
    failed: 'mdi-close-circle',
    pending: 'mdi-clock-outline',
    cancelled: 'mdi-cancel',
    stopped: 'mdi-stop-circle',
    deploying: 'mdi-rocket-launch',
    terminated: 'mdi-close-circle',
  };

  return icons[status] || 'mdi-help-circle';
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';

  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return '';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';

  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return '';
  }
}

export function safeStatusDisplay(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

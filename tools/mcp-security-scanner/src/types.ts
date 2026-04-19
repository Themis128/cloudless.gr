export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Rule {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  owaspMapping: string;
  description: string;
  patterns: string[];
  advice: string;
}

export interface Finding {
  rule: Rule;
  file: string;
  line: number;
  excerpt: string;
}

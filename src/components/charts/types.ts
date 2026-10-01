export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS color, normally a `var(--chart-N)` token. */
  color: string;
  /** One value per category; null leaves a gap (a month that has not begun). */
  values: (number | null)[];
}

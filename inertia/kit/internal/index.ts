// Kit interne (pilotage, KPI, revenus, churn, administration des comptes, alertes ops).
// Graphiques en SVG maison : couleurs = tokens du kit uniquement (var(--color-*) / color-mix).
export { KpiTile, OpsSparkline, type GoodDirection } from './kpi_tile'
export { TrendChart, type TrendPoint, type TrendAnnotation } from './trend_chart'
export { BarBreakdown, type BreakdownItem } from './bar_breakdown'
export { FunnelChart, type FunnelStep } from './funnel_chart'
export { CohortHeatmap, type CohortData } from './cohort_heatmap'
export { InsightCard, SeverityBadge, type InsightSeverity } from './insight_card'
export { AccountsTable } from './accounts_table'
export {
  AccountDrawer,
  AccountStatusBadge,
  SuspendConfirm,
  RefundForm,
  ACCOUNT_STATUS,
} from './account_drawer'
export { AlertFeed } from './alert_feed'
export { PeriodSelector, type PeriodOption, type PeriodRange } from './period_selector'
export { DashboardGrid, DashboardSection, DashboardPanel } from './dashboard_grid'
export { ReorderableWidgets, type Widget as ReorderableWidget } from './reorderable_widgets'
export { FlexBalance } from './flex_balance'
export { ChurnReasons, type ChurnReason } from './churn_reasons'
export { fmtCompact, fmtEuroCompact, fmtPct, fmtSignedPct } from './chart_utils'
/** Données fictives du scénario mylight150 (35 000 foyers, MRR ≈ 1 M€). */
export * as internalMocks from './mocks'
export type {
  CustomerAccount,
  AccountStatus,
  OpsAlert,
  AlertSeverity,
  OfferId,
  PeriodKey as InternalPeriodKey,
  DateRange as InternalDateRange,
  DashboardData,
  CompareMode,
} from './mocks'

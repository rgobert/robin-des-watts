// Kit B2C · engagement (revenir chaque jour) : prévision, défis, cagnotte, pilotage, onboarding.
// Patterns P9 à P17 du benchmark.
export {
  ProbabilisticForecast,
  DEFAULT_FORECAST,
  type ForecastDay,
  type ForecastSlot,
} from './probabilistic_forecast'
export { BonusHoursEvent, type BonusHoursRecap } from './bonus_hours_event'
export { RewardReveal } from './reward_reveal'
export { CagnotteWithdraw } from './cagnotte_withdraw'
export { OptOutTomorrow, type OptOutChoice } from './opt_out_tomorrow'
export { MonthlySolarTier, DEFAULT_SOLAR_TIERS, type SolarTier } from './monthly_solar_tier'
export { KwhCostBreakdown, DEFAULT_KWH_SOURCES, type KwhSource } from './kwh_cost_breakdown'
export {
  RobinPlanTomorrow,
  DEFAULT_PLAN_CURVE,
  DEFAULT_PLAN_SLOTS,
  type PlanPoint,
  type PlanSlot,
} from './robin_plan_tomorrow'
export { IntentGoal, DEFAULT_INTENTS, type Intent, type IntentStatus } from './intent_goal'
export {
  SmartOnboarding,
  estimateSmartGain,
  DEFAULT_ONBOARDING_ASSUMPTIONS,
  DEMO_ONBOARDING_ANSWERS,
  type OnboardingAnswers,
  type OnboardingEstimate,
  type OnboardingAssumptions,
} from './smart_onboarding'
export { LensToggle, type LensOption } from './lens_toggle'
export { YearCalendar, type CalendarDay } from './year_calendar'
export { TrophyShelf, type Trophy } from './trophy_shelf'

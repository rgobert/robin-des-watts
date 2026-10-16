// Kit B2B (usage pro : installateurs, partenaires). Densité, volume, clavier, zéro temps perdu.
export {
  ProDataTable,
  type ProColumn,
  type ProBulkAction,
  type ProSort,
  type ProDensity,
} from './pro_data_table'
export {
  FilterBar,
  applyFilters,
  type FilterDef,
  type FilterOption,
  type FilterValue,
} from './filter_bar'
export {
  StatusPipeline,
  type PipelineStep,
  type PipelineDelay,
  type PipelineNextAction,
} from './status_pipeline'
export { CommandPalette, type CommandItem } from './command_palette'
export { FormWizard, type WizardStep, type WizardField, type WizardValues } from './form_wizard'
export { InlineEdit } from './inline_edit'
export { ProQuoteSummary, type QuoteEquipment } from './pro_quote_summary'
export { ActivityFeed, type ActivityEntry, type ActivityActorKind } from './activity_feed'
export { EmptyStatePro } from './empty_state_pro'
export { KeyboardHint, parseKeys } from './keyboard_hint'
export { formatRelativeFr } from './shared'
export {
  InteractiveProposal,
  type ProposalOption,
  type ProposalSection,
} from './interactive_proposal'
export {
  FleetCockpit,
  DEFAULT_FLEET_ISSUES,
  type FleetClient,
  type FleetIssue,
  type FleetIssueConfig,
} from './fleet_cockpit'
/** Données fictives du scénario SolEnergie Rhône (18 dossiers, Lyon). */
export * as b2bMocks from './mocks'
export type { Dossier, DossierStage, ProOffer } from './mocks'

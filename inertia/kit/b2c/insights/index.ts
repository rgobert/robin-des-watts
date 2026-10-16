/* B2C · « Mes données, enfin lisibles » : patterns P1 à P8 du benchmark. */
export { SelfPoweredCard, type SelfPoweredPeriod, type SelfPoweredStats } from './self_powered_card'
export { AlwaysOnCard, type NightPoint } from './always_on_card'
export {
  EnergyFlowPlus,
  type FlowPlusFlows,
  type FlowPlusNode,
  type FlowPlusTotals,
} from './energy_flow_plus'
export {
  EnergySankey,
  type SankeyFlow,
  type SankeyEquipment,
  type SankeySourceId,
  type SankeyUseId,
} from './energy_sankey'
export { SolarShareBadge } from './solar_share_badge'
export { MinSolarSlider } from './min_solar_slider'
export { PeerComparison } from './peer_comparison'
export { ProductionWeatherChart, type WeatherDay } from './production_weather_chart'
export { VirtualStockForecast, type StockPoint } from './virtual_stock_forecast'

/**
 * Validated categorical pair (dataviz validator: passes CVD separation on white; contrast WARN,
 * so every chart also shows a legend and a table view). Plain module: usable from server components.
 */
export const SERIES_COLORS = ["#1570ef", "#7fb3f5"] as const;
/** Neutral for "everything else" segments; never used as a third categorical hue. */
export const NEUTRAL_COLOR = "#c3cad6";

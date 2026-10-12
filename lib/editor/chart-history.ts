export type ChartHistory = {
  current: string;
  past: string[];
  future: string[];
};

export const CHART_HISTORY_LIMIT = 30;

export function createChartHistory(chartText: string): ChartHistory {
  return { current: chartText, past: [], future: [] };
}

export function recordChartEdit(
  history: ChartHistory,
  nextChartText: string,
): ChartHistory {
  if (nextChartText === history.current) return history;

  return {
    current: nextChartText,
    past: [...history.past, history.current].slice(-CHART_HISTORY_LIMIT),
    future: [],
  };
}

export function undoChartEdit(history: ChartHistory): ChartHistory {
  if (history.past.length === 0) return history;

  return {
    current: history.past[history.past.length - 1],
    past: history.past.slice(0, -1),
    future: [history.current, ...history.future].slice(0, CHART_HISTORY_LIMIT),
  };
}

export function redoChartEdit(history: ChartHistory): ChartHistory {
  if (history.future.length === 0) return history;

  return {
    current: history.future[0],
    past: [...history.past, history.current].slice(-CHART_HISTORY_LIMIT),
    future: history.future.slice(1),
  };
}

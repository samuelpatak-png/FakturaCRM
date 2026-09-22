// Tenká vrstva nad Chart.js — farby čítame z CSS premenných, aby sedeli na svetlý aj tmavý режим.
'use strict';

const chartInstances = new Map();

function destroyChart(canvasId) {
  const existing = chartInstances.get(canvasId);
  if (existing) {
    existing.destroy();
    chartInstances.delete(canvasId);
  }
}

const shortCurrencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const Charts = {
  renderMonthlyIncome(canvas, points) {
    if (!canvas) return;
    destroyChart(canvas.id);

    if (!points.length || points.every((p) => p.value === 0)) {
      return null;
    }

    const barColor = cssVar('--color-chart-1');
    const gridColor = cssVar('--color-border');
    const textColor = cssVar('--color-fg-muted');
    const surfaceColor = cssVar('--color-surface');
    const tooltipBg = cssVar('--color-fg');
    const tooltipText = cssVar('--color-bg');

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: points.map((p) => p.shortLabel),
        datasets: [
          {
            label: 'Príjmy',
            data: points.map((p) => p.value),
            backgroundColor: barColor,
            borderRadius: 4,
            maxBarThickness: 34,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 260 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              title: (items) => points[items[0].dataIndex].fullLabel,
              label: (item) => formatCurrency(item.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: gridColor },
            ticks: { color: textColor, font: { size: 12 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: 12 },
              callback: (value) => shortCurrencyFormatter.format(value),
              maxTicksLimit: 5,
            },
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
    chartInstances.set(canvas.id, chart);
    return chart;
  },

  renderStatusDonut(canvas, segments) {
    if (!canvas) return;
    destroyChart(canvas.id);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return null;

    const tooltipBg = cssVar('--color-fg');
    const tooltipText = cssVar('--color-bg');
    const surfaceColor = cssVar('--color-surface');

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: segments.map((s) => s.label),
        datasets: [
          {
            data: segments.map((s) => s.value),
            backgroundColor: segments.map((s) => s.color),
            borderColor: surfaceColor,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { duration: 260 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => `${item.label}: ${formatCurrency(item.parsed)}`,
            },
          },
        },
      },
    });
    chartInstances.set(canvas.id, chart);
    return chart;
  },
};

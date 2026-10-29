(function (global) {
  'use strict';

  var Divisa = global.Divisa = global.Divisa || {};
  var F = Divisa.format;

  function readTheme() {
    var styles = getComputedStyle(document.documentElement);
    function token(name, fallback) {
      var value = styles.getPropertyValue(name);
      return value ? value.trim() : fallback;
    }
    return {
      accent: token('--accent', '#FFB000'),
      text: token('--text', '#F4F1E8'),
      soft: token('--text-soft', 'rgba(244,241,232,.46)'),
      grid: token('--line-soft', 'rgba(255,176,0,.09)'),
      panel: token('--panel', '#161819'),
      line: token('--line', 'rgba(255,176,0,.18)'),
      mono: token('--font-mono', "'JetBrains Mono', monospace")
    };
  }

  function withAlpha(color, alpha) {
    var value = String(color || '').trim();
    if (/^#([0-9a-f]{3})$/i.test(value)) {
      value = value.replace(/^#/, '');
      value = '#' + value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    var match = /^#([0-9a-f]{6})$/i.exec(value);
    if (match) {
      var hex = match[1];
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    return value;
  }

  function create(canvas, points, options) {
    if (!global.Chart || !canvas || !points || !points.length) return null;
    if (canvas._divisaChart) {
      canvas._divisaChart.destroy();
      canvas._divisaChart = null;
    }

    var from = options.from;
    var to = options.to;
    var theme = readTheme();
    var labels = points.map(function (point) { return F.formatDateShort(point.date); });
    var values = points.map(function (point) { return point.rate; });

    var chart = new global.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: from + ' → ' + to,
          data: values,
          borderColor: theme.accent,
          borderWidth: 2.4,
          backgroundColor: function (context) {
            var chartArea = context.chart.chartArea;
            if (!chartArea) return withAlpha(readTheme().accent, .05);
            var gradient = context.chart.ctx.createLinearGradient(
              0, chartArea.top, 0, chartArea.bottom
            );
            var accent = readTheme().accent;
            gradient.addColorStop(0, withAlpha(accent, .26));
            gradient.addColorStop(1, withAlpha(accent, 0));
            return gradient;
          },
          fill: true,
          tension: .28,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBorderWidth: 0,
          pointBackgroundColor: theme.accent,
          pointHoverBackgroundColor: theme.accent,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        animation: { duration: 550 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: theme.panel,
            titleColor: theme.text,
            bodyColor: theme.accent,
            borderColor: theme.line,
            borderWidth: 1,
            padding: 10,
            titleFont: { family: theme.mono, size: 10, weight: '500' },
            bodyFont: { family: theme.mono, size: 12, weight: '700' },
            callbacks: {
              title: function (items) {
                return items.length ? items[0].label : '';
              },
              label: function (item) {
                return '1 ' + from + ' = ' + F.formatRate(item.parsed.y) + ' ' + to;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: theme.soft,
              maxTicksLimit: 7,
              maxRotation: 0,
              autoSkip: true,
              font: { family: theme.mono, size: 9 }
            }
          },
          y: {
            grid: { color: theme.grid, drawTicks: false },
            border: { display: false },
            ticks: {
              color: theme.soft,
              maxTicksLimit: 5,
              padding: 8,
              font: { family: theme.mono, size: 9 },
              callback: function (value) {
                return F.formatRate(value);
              }
            }
          }
        }
      }
    });

    canvas._divisaChart = chart;
    return chart;
  }

  function applyTheme(chart) {
    if (!chart) return;
    var theme = readTheme();
    var dataset = chart.data.datasets[0];
    if (dataset) {
      dataset.borderColor = theme.accent;
      dataset.pointBackgroundColor = theme.accent;
      dataset.pointHoverBackgroundColor = theme.accent;
    }
    if (chart.options.plugins && chart.options.plugins.tooltip) {
      var tooltip = chart.options.plugins.tooltip;
      tooltip.backgroundColor = theme.panel;
      tooltip.titleColor = theme.text;
      tooltip.bodyColor = theme.accent;
      tooltip.borderColor = theme.line;
      tooltip.titleFont = { family: theme.mono, size: 10, weight: '500' };
      tooltip.bodyFont = { family: theme.mono, size: 12, weight: '700' };
    }
    if (chart.options.scales) {
      chart.options.scales.x.ticks.color = theme.soft;
      chart.options.scales.x.ticks.font = { family: theme.mono, size: 9 };
      chart.options.scales.y.ticks.color = theme.soft;
      chart.options.scales.y.ticks.font = { family: theme.mono, size: 9 };
      chart.options.scales.y.grid.color = theme.grid;
    }
    chart.update('none');
  }

  function destroy(chart) {
    if (chart) chart.destroy();
  }

  Divisa.chart = {
    create: create,
    applyTheme: applyTheme,
    destroy: destroy
  };
})(window);

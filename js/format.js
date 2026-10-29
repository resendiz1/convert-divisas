(function (global) {
  'use strict';

  var Divisa = global.Divisa = global.Divisa || {};
  var NUMBER_LOCALE = 'es-MX';
  var formatterCache = new Map();

  function getNumberFormatter(options) {
    var key = JSON.stringify(options);
    var formatter = formatterCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(NUMBER_LOCALE, options);
      formatterCache.set(key, formatter);
    }
    return formatter;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function parseAmount(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : NaN;
    }
    if (value === null || value === undefined) return NaN;

    var raw = String(value).trim();
    if (!raw) return NaN;

    var negative = /^\s*-/.test(raw) || /^\(.*\)$/.test(raw);
    var cleaned = raw.replace(/[^\d.,]/g, '');
    if (!cleaned) return NaN;

    var hasComma = cleaned.indexOf(',') !== -1;
    var hasDot = cleaned.indexOf('.') !== -1;

    if (hasComma && hasDot) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      var commaParts = cleaned.split(',');
      if (commaParts.length === 2 && commaParts[1].length === 3 && commaParts[0] !== '0') {
        cleaned = commaParts.join('');
      } else {
        cleaned = commaParts.slice(0, -1).join('') + '.' + commaParts[commaParts.length - 1];
      }
    } else if (hasDot) {
      var dotParts = cleaned.split('.');
      if (dotParts.length > 2) {
        cleaned = dotParts.join('');
      } else if (dotParts[1] && dotParts[1].length === 3 && dotParts[0] !== '0') {
        cleaned = dotParts.join('');
      }
    }

    var number = Number(cleaned);
    if (!Number.isFinite(number)) return NaN;
    return negative ? -number : number;
  }

  function currencyInfo(code) {
    return (Divisa.CURRENCY_MAP && Divisa.CURRENCY_MAP[code]) || null;
  }

  function currencyDecimals(code) {
    var info = currencyInfo(code);
    return info ? info.decimals : 2;
  }

  function formatNumber(value, decimalsOrOptions) {
    if (!Number.isFinite(Number(value))) return '—';
    var options;
    if (typeof decimalsOrOptions === 'object' && decimalsOrOptions !== null) {
      options = decimalsOrOptions;
    } else {
      var decimals = typeof decimalsOrOptions === 'number' ? decimalsOrOptions : 2;
      options = {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      };
    }
    try {
      return getNumberFormatter(options).format(Number(value));
    } catch (error) {
      return String(value);
    }
  }

  function formatMoney(value, code, options) {
    if (!Number.isFinite(Number(value))) return '—';
    var info = currencyInfo(code);
    var symbol = info ? info.symbol : code;
    var decimals = options && typeof options.decimals === 'number'
      ? options.decimals
      : currencyDecimals(code);
    var number = Number(value);
    var sign = number < 0 ? '-' : '';
    var formatted = formatNumber(Math.abs(number), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return sign + symbol + '\u00A0' + formatted;
  }

  function formatRate(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return '—';
    var abs = Math.abs(number);
    var max;
    if (abs >= 1000) max = 2;
    else if (abs >= 100) max = 3;
    else if (abs >= 1) max = 4;
    else if (abs >= 0.01) max = 6;
    else max = 8;
    try {
      return getNumberFormatter({
        minimumFractionDigits: Math.min(2, max),
        maximumFractionDigits: max
      }).format(number);
    } catch (error) {
      return String(number);
    }
  }

  function formatPercent(value, digits) {
    var number = Number(value);
    if (!Number.isFinite(number)) return '—';
    var decimals = typeof digits === 'number' ? digits : 1;
    return formatNumber(number, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + '%';
  }

  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value + 'T12:00:00');
      }
      return new Date(value);
    }
    return null;
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function formatDateTime(value) {
    var date = toDate(value);
    if (!isValidDate(date)) return '—';
    try {
      return new Intl.DateTimeFormat(NUMBER_LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  }

  function formatDateShort(value) {
    var date = toDate(value);
    if (!isValidDate(date)) return String(value || '—');
    try {
      return new Intl.DateTimeFormat(NUMBER_LOCALE, {
        day: '2-digit',
        month: 'short'
      }).format(date);
    } catch (error) {
      return String(value);
    }
  }

  function formatTime(value) {
    var date = toDate(value);
    if (!isValidDate(date)) return '—';
    try {
      return new Intl.DateTimeFormat(NUMBER_LOCALE, {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return date.toLocaleTimeString();
    }
  }

  function timeAgo(value) {
    var date = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(date)) return '';
    var diff = Math.max(0, Date.now() - date);
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'hace unos segundos';
    if (minutes < 60) return 'hace ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return 'hace ' + hours + ' h';
    var days = Math.floor(hours / 24);
    if (days < 30) return 'hace ' + days + ' d';
    var months = Math.floor(days / 30);
    return 'hace ' + months + ' mes' + (months === 1 ? '' : 'es');
  }

  function readNumber(input, fallback) {
    if (input === null || input === undefined) return fallback;
    var value = typeof input === 'number' ? input : Number(String(input).replace(',', '.'));
    return Number.isFinite(value) ? value : fallback;
  }

  Divisa.format = {
    clamp: clamp,
    parseAmount: parseAmount,
    currencyInfo: currencyInfo,
    currencyDecimals: currencyDecimals,
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    formatRate: formatRate,
    formatPercent: formatPercent,
    formatDateTime: formatDateTime,
    formatDateShort: formatDateShort,
    formatTime: formatTime,
    timeAgo: timeAgo,
    readNumber: readNumber
  };
})(window);

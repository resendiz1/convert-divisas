(function (global) {
  'use strict';

  var Divisa = global.Divisa = global.Divisa || {};
  var CFG = Divisa.CONFIG;
  var historyCache = new Map();
  var memoryLatest = null;
  var inflightLatest = null;

  function createError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function isRatesObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CFG.cacheKey);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !isRatesObject(data.rates) || !Number.isFinite(Number(data.fetchedAt))) {
        return null;
      }
      if (!Number.isFinite(Number(data.rates.USD)) || !Number.isFinite(Number(data.rates.MXN))) {
        return null;
      }
      return data;
    } catch (error) {
      return null;
    }
  }

  function saveCache(payload) {
    try {
      localStorage.setItem(CFG.cacheKey, JSON.stringify({
        base: payload.base,
        rates: payload.rates,
        source: payload.source,
        sourceUrl: payload.sourceUrl,
        updatedAt: payload.updatedAt,
        nextUpdate: payload.nextUpdate,
        fetchedAt: payload.fetchedAt
      }));
    } catch (error) {
      /* almacenamiento no disponible */
    }
  }

  function peekCache() {
    var cached = readCache();
    if (!cached) return null;
    return Object.assign({}, cached, {
      stale: false,
      seed: false,
      error: null,
      fromCache: true
    });
  }

  async function requestLatest(cached) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.fetchTimeout);

    try {
      var response = await fetch(CFG.apiLatest, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw createError('HTTP', 'La API respondió con estado ' + response.status + '.');
      }
      var data = await response.json();
      if (!data || data.result !== 'success' || !isRatesObject(data.rates)) {
        throw createError('INVALID', 'La respuesta de la API no tiene un formato válido.');
      }

      ['USD', 'MXN', 'EUR', 'GBP', 'JPY'].forEach(function (code) {
        if (!Number.isFinite(Number(data.rates[code]))) {
          throw createError('INVALID', 'Faltan tipos de cambio esenciales en la respuesta.');
        }
      });

      var updated = Number(data.time_last_update_unix);
      var next = Number(data.time_next_update_unix);
      var payload = {
        base: data.base_code || 'USD',
        rates: data.rates,
        source: CFG.latestSource,
        sourceUrl: data.provider || CFG.latestSourceUrl,
        updatedAt: Number.isFinite(updated) ? updated * 1000 : Date.now(),
        nextUpdate: Number.isFinite(next) ? next * 1000 : null,
        fetchedAt: Date.now(),
        stale: false,
        seed: false,
        error: null
      };

      memoryLatest = payload;
      saveCache(payload);
      return payload;
    } catch (error) {
      var fallback = cached || memoryLatest;
      if (fallback) {
        return Object.assign({}, fallback, {
          stale: true,
          seed: false,
          error: error
        });
      }
      return {
        base: 'USD',
        rates: Divisa.SEED_RATES,
        source: 'Respaldo local',
        sourceUrl: null,
        updatedAt: Divisa.SEED_DATE,
        nextUpdate: null,
        fetchedAt: Date.now(),
        stale: true,
        seed: true,
        error: error
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function fetchLatest(options) {
    var force = !!(options && options.force);
    var cached = readCache();

    if (!force) {
      if (memoryLatest && Date.now() - memoryLatest.fetchedAt < CFG.cacheTtl) {
        return Promise.resolve(memoryLatest);
      }
      if (cached && Date.now() - cached.fetchedAt < CFG.cacheTtl) {
        memoryLatest = Object.assign({}, cached, {
          stale: false,
          seed: false,
          error: null,
          fromCache: true
        });
        return Promise.resolve(memoryLatest);
      }
      if (inflightLatest) return inflightLatest;
    }

    var promise = requestLatest(cached);
    if (!force) {
      inflightLatest = promise;
      promise.finally(function () {
        if (inflightLatest === promise) inflightLatest = null;
      });
    }
    return promise;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function sameCurrencyHistory(from, days) {
    var points = [];
    var now = new Date();
    for (var i = days; i >= 0; i -= 1) {
      var date = new Date(now.getTime() - i * 86400000);
      points.push({ date: dateISO(date), rate: 1 });
    }
    return {
      points: points,
      from: from,
      to: from,
      days: days,
      source: CFG.historySource,
      sourceUrl: CFG.historySourceUrl,
      fetchedAt: Date.now(),
      startDate: points[0].date,
      endDate: points[points.length - 1].date
    };
  }

  async function fetchHistory(from, to, days, options) {
    var force = !!(options && options.force);
    var safeDays = Math.max(1, Math.min(365, Number(days) || 30));

    if (!Divisa.HISTORY_SUPPORTED.has(from) || !Divisa.HISTORY_SUPPORTED.has(to)) {
      throw createError(
        'UNSUPPORTED',
        'La fuente histórica no cubre una de las monedas seleccionadas.'
      );
    }

    if (from === to) return sameCurrencyHistory(from, safeDays);

    var key = from + ':' + to + ':' + safeDays;
    var cached = historyCache.get(key);
    if (!force && cached && Date.now() - cached.fetchedAt < CFG.historyTtl) {
      return cached;
    }

    var end = new Date();
    var start = new Date(end.getTime() - safeDays * 86400000);
    var url = CFG.apiHistory + '/' + dateISO(start) + '..' + dateISO(end) +
      '?base=' + encodeURIComponent(from) + '&symbols=' + encodeURIComponent(to);

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.historyTimeout);

    try {
      var response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw createError('HTTP', 'El histórico respondió con estado ' + response.status + '.');
      }
      var data = await response.json();
      if (!data || !isRatesObject(data.rates)) {
        throw createError('NO_DATA', 'No hay datos históricos para este par.');
      }

      var points = Object.keys(data.rates).sort().map(function (date) {
        var row = data.rates[date];
        var rate = row && row[to];
        return { date: date, rate: Number(rate) };
      }).filter(function (point) {
        return Number.isFinite(point.rate) && point.rate > 0;
      });

      if (!points.length) {
        throw createError('NO_DATA', 'No hay datos históricos para este par en el periodo.');
      }

      var payload = {
        points: points,
        from: from,
        to: to,
        days: safeDays,
        source: CFG.historySource,
        sourceUrl: CFG.historySourceUrl,
        fetchedAt: Date.now(),
        startDate: data.start_date || points[0].date,
        endDate: data.end_date || points[points.length - 1].date
      };

      historyCache.set(key, payload);
      return payload;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw createError('TIMEOUT', 'La consulta del histórico tardó demasiado.');
      }
      if (error && error.code) throw error;
      throw createError('NETWORK', 'No se pudo consultar el histórico.');
    } finally {
      clearTimeout(timer);
    }
  }

  function clearHistoryCache() {
    historyCache.clear();
  }

  Divisa.api = {
    fetchLatest: fetchLatest,
    fetchHistory: fetchHistory,
    peekCache: peekCache,
    clearHistoryCache: clearHistoryCache
  };
})(window);

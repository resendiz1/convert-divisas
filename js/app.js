(function (global) {
  'use strict';

  var Divisa = global.Divisa = global.Divisa || {};
  var F = Divisa.format;
  var API = Divisa.api;
  var CFG = Divisa.CONFIG;

  var STORAGE = {
    theme: 'divisa:theme',
    favorites: 'divisa:favorites',
    fee: 'divisa:fee',
    budget: 'divisa:budget',
    history: 'divisa:history'
  };

  var state = {
    amount: Divisa.DEFAULT_PAIR.amount,
    from: Divisa.DEFAULT_PAIR.from,
    to: Divisa.DEFAULT_PAIR.to,
    rates: Divisa.SEED_RATES,
    meta: null,
    loadingRates: false,
    favorites: [],
    fee: { enabled: false, percent: 1.5, fixed: 0 },
    provider: {
      preset: 'banco',
      name: 'Banco',
      rate: null,
      spread: 1.5,
      commission: 2.5,
      fixed: 0
    },
    compare: { amount: 1000, base: 'MXN', search: '', favOnly: false, all: false },
    budget: [],
    product: { price: 99, shipping: 12, tax: 16, fees: 3 },
    history: [],
    chart: { days: 30, data: null, loading: false, requestId: 0 }
  };

  var el = {};
  var historyTimer = null;

  function readJSON(key, fallback, session) {
    try {
      var store = session ? global.sessionStorage : global.localStorage;
      var raw = store.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value, session) {
    try {
      var store = session ? global.sessionStorage : global.localStorage;
      store.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* almacenamiento no disponible */
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  function validCurrency(code) {
    return !!code && Object.prototype.hasOwnProperty.call(Divisa.CURRENCY_MAP, code);
  }

  function pairKey(from, to) {
    return from + ':' + to;
  }

  function isPairKey(key) {
    if (typeof key !== 'string') return false;
    var parts = key.split(':');
    return parts.length === 2 && validCurrency(parts[0]) && validCurrency(parts[1]);
  }

  function pairParts(key) {
    var parts = String(key).split(':');
    return { from: parts[0], to: parts[1] };
  }

  function tradeRate(from, to) {
    var rates = state.rates || Divisa.SEED_RATES;
    var a = Number(rates[from]);
    var b = Number(rates[to]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return NaN;
    return b / a;
  }

  function convertValue(amount, from, to) {
    var value = Number(amount);
    var rate = tradeRate(from, to);
    if (!Number.isFinite(value) || !Number.isFinite(rate)) return NaN;
    return value * rate;
  }

  function signedMoney(value, code) {
    var number = Number(value);
    if (!Number.isFinite(number)) return '—';
    var sign = number > 0 ? '+' : number < 0 ? '−' : '';
    return sign + F.formatMoney(Math.abs(number), code);
  }

  function normalizeSearch(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isFavorite(from, to) {
    return state.favorites.indexOf(pairKey(from, to)) !== -1;
  }

  function cacheElements() {
    [
      'themeColorMeta', 'themeToggle', 'marketStatus', 'converterStatus',
      'converterForm', 'amountSymbol', 'amountInput', 'amountCode', 'amountHint',
      'amountError', 'fromSelect', 'swapBtn', 'toSelect', 'resultCode',
      'resultValue', 'resultName', 'rateLine', 'inverseLine', 'feeNetLine',
      'feeDetails', 'feeStateBadge', 'feeEnabled', 'feePercent', 'feeFixedSymbol',
      'feeFixed', 'copyBtn', 'shareBtn', 'favoriteBtn', 'favoriteLabel',
      'rateUpdated', 'rateSource', 'rateAge', 'offlineBadge', 'refreshBtn',
      'apiAlert', 'apiAlertTitle', 'apiAlertText', 'apiAlertRetry', 'tickerTrack',
      'tickerGroup', 'favoritesCount', 'favoritesList', 'favoritesEmpty',
      'equivalencePairLabel', 'equivalenceBody', 'equivalenceRate', 'invertPairBtn',
      'feePairLabel', 'feeBaseAmount', 'feeGross', 'feeTotalCost', 'feeNet',
      'feeEffRate', 'feeEditBtn', 'providerPairLabel', 'providerPresets',
      'providerName', 'providerRate', 'providerSpread', 'providerCommission',
      'providerFixedSymbol', 'providerFixed', 'providerHint', 'providerRefRate',
      'providerEffRate', 'providerRefAmount', 'providerAmount', 'providerDiff',
      'providerCost', 'chartPairLabel', 'chartRateLabel', 'rateChart',
      'chartLoading', 'chartEmpty', 'chartEmptyTitle', 'chartEmptyText',
      'chartMin', 'chartMax', 'chartAvg', 'chartChange', 'chartSource',
      'chartUpdated', 'chartTableBody', 'compareAmount', 'compareBase',
      'compareSearch', 'compareFavOnly', 'compareBody', 'compareEmpty',
      'compareCount', 'compareToggle', 'budgetPairLabel', 'budgetForeignLabel',
      'budgetLocalLabel', 'budgetBody', 'budgetTotalForeign', 'budgetTotalLocal',
      'budgetAdd', 'budgetReset', 'productPairLabel', 'productPriceLabel',
      'productShippingLabel', 'productPrice', 'productShipping', 'productTax',
      'productFees', 'productError', 'productSubtotal', 'productShippingLocal',
      'productTaxLocal', 'productFeesLocal', 'productTotalForeign',
      'productTotalLocal', 'productRate', 'historyClear', 'historyCount',
      'historyBody', 'historyEmpty', 'afiliados', 'affiliateGrid', 'appToast',
      'toastBody'
    ].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  function fillSelect(select, selected) {
    if (!select) return;
    select.innerHTML = Divisa.CURRENCIES.map(function (currency) {
      return '<option value="' + currency.code + '">' +
        currency.flag + ' ' + currency.code + ' — ' + escapeHtml(currency.name) +
        '</option>';
    }).join('');
    if (validCurrency(selected)) select.value = selected;
  }

  function populateSelects() {
    fillSelect(el.fromSelect, state.from);
    fillSelect(el.toSelect, state.to);
    fillSelect(el.compareBase, state.compare.base);
  }

  function readUrlState() {
    try {
      var params = new URLSearchParams(global.location.search);
      var from = (params.get('from') || '').toUpperCase();
      var to = (params.get('to') || '').toUpperCase();
      var rawAmount = params.get('amount');
      if (validCurrency(from)) state.from = from;
      if (validCurrency(to)) state.to = to;
      if (rawAmount !== null) {
        var amount = F.parseAmount(rawAmount);
        if (Number.isFinite(amount) && amount >= 0) state.amount = amount;
      }
    } catch (error) {
      /* URL no disponible */
    }
  }

  function loadStoredState() {
    var favorites = readJSON(STORAGE.favorites, []);
    if (Array.isArray(favorites)) {
      state.favorites = favorites.filter(isPairKey).slice(0, 30);
    }

    var fee = readJSON(STORAGE.fee, null);
    if (fee && typeof fee === 'object') {
      state.fee.enabled = !!fee.enabled;
      state.fee.percent = F.readNumber(fee.percent, 1.5);
      state.fee.fixed = F.readNumber(fee.fixed, 0);
    }

    var budget = readJSON(STORAGE.budget, null, true);
    if (Array.isArray(budget) && budget.length) {
      state.budget = budget.filter(function (row) {
        return row && typeof row === 'object';
      }).map(function (row) {
        return {
          label: String(row.label || 'Categoría'),
          amount: row.amount === '' || row.amount === null ? '' : row.amount
        };
      }).slice(0, 30);
    } else {
      state.budget = Divisa.DEFAULT_BUDGET.map(function (row) {
        return { label: row.label, amount: row.amount };
      });
    }

    var history = readJSON(STORAGE.history, [], true);
    if (Array.isArray(history)) {
      state.history = history.filter(function (item) {
        return item && validCurrency(item.from) && validCurrency(item.to) &&
          Number.isFinite(Number(item.amount)) && Number.isFinite(Number(item.result));
      }).slice(0, CFG.maxHistory);
    }

    var compare = readJSON('divisa:compare', null);
    if (compare && validCurrency(compare.base)) {
      state.compare.base = compare.base;
      state.compare.amount = F.readNumber(compare.amount, 1000);
      state.compare.favOnly = !!compare.favOnly;
      state.compare.all = !!compare.all;
    }
  }

  function syncInputs() {
    el.amountInput.value = Number.isFinite(state.amount) ? String(state.amount) : '';
    el.fromSelect.value = state.from;
    el.toSelect.value = state.to;
    el.compareBase.value = state.compare.base;
    el.compareAmount.value = F.formatNumber(state.compare.amount, {
      maximumFractionDigits: 2
    });
    el.compareSearch.value = '';
    el.compareFavOnly.checked = state.compare.favOnly;
    el.feeEnabled.checked = state.fee.enabled;
    el.feePercent.value = state.fee.percent;
    el.feeFixed.value = state.fee.fixed;
    el.providerName.value = state.provider.name;
    el.providerSpread.value = state.provider.spread;
    el.providerCommission.value = state.provider.commission;
    el.providerFixed.value = state.provider.fixed;
    el.providerRate.value = '';
    el.productPrice.value = state.product.price;
    el.productShipping.value = state.product.shipping;
    el.productTax.value = state.product.tax;
    el.productFees.value = state.product.fees;
    el.feeFixedSymbol.textContent = currencySymbol(state.from);
    el.providerFixedSymbol.textContent = currencySymbol(state.from);
  }

  function currencySymbol(code) {
    var info = Divisa.CURRENCY_MAP[code];
    return info ? info.symbol : code;
  }

  function initTheme() {
    var current = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current, false);
  }

  function applyTheme(theme, persist) {
    var next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    var isLight = next === 'light';
    el.themeToggle.setAttribute('aria-pressed', String(isLight));
    el.themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    if (el.themeColorMeta) {
      el.themeColorMeta.setAttribute('content', isLight ? '#FAF7EF' : '#0B0D0E');
    }
    if (persist) {
      try {
        global.localStorage.setItem(STORAGE.theme, next);
      } catch (error) {
        /* almacenamiento no disponible */
      }
    }
    if (el.rateChart && el.rateChart._divisaChart && Divisa.chart) {
      Divisa.chart.applyTheme(el.rateChart._divisaChart);
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-bs-theme');
    applyTheme(current === 'light' ? 'dark' : 'light', true);
  }

  function showToast(message) {
    if (!el.appToast || !el.toastBody) return;
    el.toastBody.textContent = message;
    if (global.bootstrap && global.bootstrap.Toast) {
      global.bootstrap.Toast.getOrCreateInstance(el.appToast, { delay: 2800 }).show();
      return;
    }
    el.appToast.classList.add('show');
    global.setTimeout(function () {
      el.appToast.classList.remove('show');
    }, 2800);
  }

  function copyText(text) {
    if (global.navigator.clipboard && global.isSecureContext) {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (ok) resolve();
        else reject(new Error('No se pudo copiar.'));
      } catch (error) {
        reject(error);
      }
    });
  }

  function shareUrl() {
    try {
      var url = new URL(global.location.href);
      url.search = '';
      url.hash = '';
      var params = new URLSearchParams();
      params.set('from', state.from);
      params.set('to', state.to);
      if (Number.isFinite(state.amount)) params.set('amount', String(state.amount));
      url.search = params.toString();
      return url.toString();
    } catch (error) {
      return global.location.href;
    }
  }

  function syncUrl() {
    try {
      if (!global.history || !global.history.replaceState) return;
      global.history.replaceState(null, '', shareUrl());
    } catch (error) {
      /* URL no disponible */
    }
  }

  function setProviderRate(value) {
    var parsed = F.parseAmount(value);
    state.provider.rate = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (state.provider.rate) state.provider.preset = '';
    renderProvider();
  }

  function resetProviderRate() {
    state.provider.rate = null;
    if (el.providerRate) el.providerRate.value = '';
  }

  function setAmount(value, options) {
    var parsed = typeof value === 'number' ? value : F.parseAmount(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    state.amount = Math.min(parsed, CFG.maxAmount);
    el.amountInput.value = String(state.amount);
    el.amountError.hidden = true;
    renderDerived();
    syncUrl();
    if (options && options.record) recordHistory();
  }

  function applyPair(from, to, options) {
    if (validCurrency(from)) state.from = from;
    if (validCurrency(to)) state.to = to;
    if (options && options.amount !== undefined) {
      var parsed = F.parseAmount(options.amount);
      if (Number.isFinite(parsed) && parsed >= 0) state.amount = Math.min(parsed, CFG.maxAmount);
      el.amountInput.value = Number.isFinite(state.amount) ? String(state.amount) : '';
    }
    el.fromSelect.value = state.from;
    el.toSelect.value = state.to;
    resetProviderRate();
    renderAll();
    loadChart();
    syncUrl();
    if (options && options.record) recordHistory();
    if (options && options.scroll) {
      var target = document.getElementById('conversor');
      if (target) {
        var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
    }
  }

  function renderAll() {
    renderHeader();
    renderDerived();
    renderFavorites();
    renderHistory();
  }

  function renderDerived() {
    renderConverter();
    renderFees();
    renderProvider();
    renderEquivalences();
    renderCompare();
    renderBudget();
    renderProduct();
    renderPairCards();
  }

  function updateMarketStatus() {
    var online = global.navigator.onLine !== false;
    if (!online) {
      el.marketStatus.textContent = 'Sin conexión';
      return;
    }
    var now = new Date();
    var day = now.getUTCDay();
    var open = day >= 1 && day <= 5;
    el.marketStatus.textContent = open ? 'Mercado abierto' : 'Mercado cerrado';
  }

  function renderHeader() {
    updateMarketStatus();

    var online = global.navigator.onLine !== false;
    var meta = state.meta;
    var label = 'En línea';
    var lit = true;

    if (!online) {
      label = 'Sin conexión';
      lit = false;
    } else if (state.loadingRates) {
      label = 'Actualizando…';
    } else if (meta && meta.seed) {
      label = 'Respaldo local';
      lit = false;
    } else if (meta && meta.stale) {
      label = 'Datos guardados';
      lit = false;
    }

    el.converterStatus.innerHTML = '<span class="lamp' + (lit ? ' lamp-lit' : '') +
      '" aria-hidden="true"></span>' + label;
    el.converterStatus.classList.toggle('is-offline', !online);
    el.offlineBadge.hidden = online;

    if (meta) {
      el.rateUpdated.textContent = F.formatDateTime(meta.updatedAt || meta.fetchedAt);
      el.rateSource.textContent = meta.source || '—';
      if (meta.sourceUrl) {
        el.rateSource.setAttribute('href', meta.sourceUrl);
        el.rateSource.setAttribute('target', '_blank');
        el.rateSource.setAttribute('rel', 'noopener');
      } else {
        el.rateSource.removeAttribute('href');
        el.rateSource.removeAttribute('target');
        el.rateSource.removeAttribute('rel');
      }
      if (meta.seed) {
        el.rateAge.textContent = 'datos de respaldo';
      } else {
        el.rateAge.textContent = F.timeAgo(meta.fetchedAt) +
          (meta.fromCache ? ' · caché' : '');
      }
    } else {
      el.rateUpdated.textContent = '—';
      el.rateSource.textContent = '—';
      el.rateSource.removeAttribute('href');
      el.rateAge.textContent = 'consultando';
    }

    var showAlert = meta && meta.error && (!online || meta.stale || meta.seed);
    el.apiAlert.hidden = !showAlert;
    if (showAlert) {
      var seed = !!meta.seed;
      el.apiAlert.classList.toggle('is-warning', !seed);
      el.apiAlertTitle.textContent = seed
        ? 'No se pudieron cargar los tipos de cambio'
        : 'No se pudieron actualizar los tipos';
      if (seed) {
        el.apiAlertText.textContent = 'Se muestran datos de respaldo con fecha ' +
          F.formatDateTime(meta.updatedAt) + ' Comprueba tu conexión e inténtalo de nuevo.';
      } else {
        el.apiAlertText.textContent = 'Estás viendo los últimos datos guardados (' +
          F.formatDateTime(meta.fetchedAt) + '). El conversor sigue funcionando.';
      }
    }
  }

  function converterValues() {
    var amount = Number(state.amount);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var rate = tradeRate(state.from, state.to);
    if (!Number.isFinite(rate)) return null;

    var fee = state.fee;
    var percent = fee.enabled ? F.clamp(F.readNumber(fee.percent, 0), 0, 100) : 0;
    var fixed = fee.enabled ? Math.max(0, F.readNumber(fee.fixed, 0)) : 0;
    var cost = fee.enabled ? Math.min(amount, amount * percent / 100 + fixed) : 0;
    var netFrom = Math.max(0, amount - cost);

    return {
      amount: amount,
      rate: rate,
      percent: percent,
      fixed: fixed,
      cost: cost,
      netFrom: netFrom,
      grossTo: amount * rate,
      netTo: netFrom * rate
    };
  }

  function updateFavoriteButton() {
    var active = isFavorite(state.from, state.to);
    el.favoriteBtn.classList.toggle('is-active', active);
    el.favoriteBtn.setAttribute('aria-pressed', String(active));
    el.favoriteBtn.title = active
      ? 'Quitar ' + state.from + ' → ' + state.to + ' de favoritos'
      : 'Guardar ' + state.from + ' → ' + state.to + ' en favoritos';
    el.favoriteLabel.textContent = active ? 'En favoritos' : 'Favorito';
  }

  function renderConverter() {
    var fromInfo = Divisa.CURRENCY_MAP[state.from];
    var toInfo = Divisa.CURRENCY_MAP[state.to];
    el.amountSymbol.textContent = fromInfo ? fromInfo.symbol : state.from;
    el.amountCode.textContent = state.from;
    el.resultCode.textContent = state.to;
    el.resultName.textContent = toInfo ? toInfo.name : '';

    var values = converterValues();
    if (!values) {
      el.resultValue.textContent = '—';
      el.rateLine.textContent = '1 ' + state.from + ' = — ' + state.to;
      el.inverseLine.textContent = '1 ' + state.to + ' = — ' + state.from;
      el.feeNetLine.hidden = true;
      updateFavoriteButton();
      return;
    }

    el.resultValue.textContent = F.formatMoney(values.netTo, state.to);
    el.rateLine.textContent = '1 ' + state.from + ' = ' +
      F.formatRate(values.rate) + ' ' + state.to;
    el.inverseLine.textContent = '1 ' + state.to + ' = ' +
      F.formatRate(1 / values.rate) + ' ' + state.from;

    if (state.fee.enabled) {
      el.feeNetLine.hidden = false;
      el.feeNetLine.textContent = 'Neto tras comisión: ' +
        F.formatMoney(values.netFrom, state.from) + ' · Costo ' +
        F.formatMoney(values.cost, state.from);
    } else {
      el.feeNetLine.hidden = true;
    }

    updateFavoriteButton();
  }

  function renderFees() {
    el.feePairLabel.textContent = state.from + ' → ' + state.to;
    el.feeFixedSymbol.textContent = currencySymbol(state.from);
    el.feeStateBadge.textContent = state.fee.enabled ? 'Activa' : 'Desactivada';
    el.feeStateBadge.classList.toggle('is-on', state.fee.enabled);

    var values = converterValues();
    if (!values) {
      ['feeBaseAmount', 'feeGross', 'feeTotalCost', 'feeNet', 'feeEffRate'].forEach(function (id) {
        el[id].textContent = '—';
      });
      return;
    }

    el.feeBaseAmount.textContent = F.formatMoney(values.amount, state.from);
    el.feeGross.textContent = F.formatMoney(values.grossTo, state.to);
    el.feeTotalCost.textContent = state.fee.enabled
      ? F.formatMoney(values.cost, state.from) + ' (' +
        F.formatPercent(values.amount > 0 ? values.cost / values.amount * 100 : 0) + ')'
      : 'Sin comisión';
    el.feeNet.textContent = F.formatMoney(values.netTo, state.to);
    el.feeEffRate.textContent = '1 ' + state.from + ' = ' +
      F.formatRate(values.amount > 0 ? values.netTo / values.amount : 0) + ' ' + state.to;
  }

  function renderProvider() {
    el.providerPairLabel.textContent = state.from + ' → ' + state.to;
    el.providerFixedSymbol.textContent = currencySymbol(state.from);

    if (document.activeElement !== el.providerName && el.providerName.value !== state.provider.name) {
      el.providerName.value = state.provider.name;
    }

    var amount = Number(state.amount);
    var refRate = tradeRate(state.from, state.to);
    var percent = F.clamp(F.readNumber(state.provider.commission, 0), 0, 100);
    var spread = F.clamp(F.readNumber(state.provider.spread, 0), 0, 100);
    var fixed = Math.max(0, F.readNumber(state.provider.fixed, 0));
    var customRate = Number(state.provider.rate);
    var hasCustom = Number.isFinite(customRate) && customRate > 0;
    var effRate = hasCustom ? customRate : refRate * (1 - spread / 100);

    var presetButtons = el.providerPresets.querySelectorAll('[data-preset]');
    Array.prototype.forEach.call(presetButtons, function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-preset') === state.provider.preset);
    });

    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(refRate) ||
        !Number.isFinite(effRate)) {
      ['providerRefRate', 'providerEffRate', 'providerRefAmount', 'providerAmount',
        'providerDiff', 'providerCost'].forEach(function (id) {
        el[id].textContent = '—';
      });
      el.providerHint.textContent = hasCustom
        ? 'Usando la tasa capturada. El margen se ignora.'
        : 'Tasa de referencia + margen del ' + F.formatPercent(spread) + '.';
      return;
    }

    var commission = amount * percent / 100 + fixed;
    var netFrom = Math.max(0, amount - commission);
    var refAmount = amount * refRate;
    var providerAmount = netFrom * effRate;
    var diff = providerAmount - refAmount;

    el.providerRefRate.textContent = '1 ' + state.from + ' = ' +
      F.formatRate(refRate) + ' ' + state.to;
    el.providerEffRate.textContent = '1 ' + state.from + ' = ' +
      F.formatRate(effRate) + ' ' + state.to;
    el.providerRefAmount.textContent = F.formatMoney(refAmount, state.to);
    el.providerAmount.textContent = F.formatMoney(providerAmount, state.to);
    el.providerDiff.textContent = signedMoney(diff, state.to);
    el.providerCost.textContent = signedMoney(refAmount - providerAmount, state.to);

    if (hasCustom) {
      el.providerHint.textContent = 'Usando la tasa capturada. El margen se ignora.';
    } else {
      el.providerHint.textContent = 'Tasa de referencia + margen del ' +
        F.formatPercent(spread) + '.';
    }
  }

  function renderEquivalences() {
    var rate = tradeRate(state.from, state.to);
    el.equivalencePairLabel.textContent = state.from + ' → ' + state.to;
    el.invertPairBtn.textContent = 'Ver ' + state.to + ' → ' + state.from;
    el.equivalenceRate.textContent = Number.isFinite(rate)
      ? '1 ' + state.from + ' = ' + F.formatRate(rate) + ' ' + state.to
      : 'Tipo de cambio no disponible';

    if (!Number.isFinite(rate)) {
      el.equivalenceBody.innerHTML = '';
      return;
    }

    el.equivalenceBody.innerHTML = Divisa.EQUIVALENCE_AMOUNTS.map(function (amount) {
      return '<tr>' +
        '<td class="num">' + F.formatMoney(amount, state.from) + '</td>' +
        '<td>' + F.formatMoney(amount * rate, state.to) + '</td>' +
        '<td class="num">' + F.formatRate(rate) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderFavorites() {
    var count = state.favorites.length;
    el.favoritesCount.textContent = count + (count === 1 ? ' par' : ' pares');
    el.favoritesEmpty.hidden = count > 0;

    el.favoritesList.innerHTML = state.favorites.map(function (key) {
      var parts = pairParts(key);
      return '<span class="favorite-chip">' +
        '<button type="button" class="favorite-chip-main" data-fav="' + key +
        '" title="Usar ' + parts.from + ' → ' + parts.to + '">' +
        '<b>' + parts.from + '</b> → ' + parts.to + '</button>' +
        '<button type="button" class="favorite-chip-x" data-fav-remove="' + key +
        '" aria-label="Quitar ' + parts.from + ' → ' + parts.to + ' de favoritos">×</button>' +
        '</span>';
    }).join('');

    updateFavoriteButton();
  }

  function toggleFavorite(from, to) {
    var key = pairKey(from, to);
    var index = state.favorites.indexOf(key);
    if (index === -1) {
      state.favorites.unshift(key);
      showToast(from + ' → ' + to + ' guardado en favoritos.');
    } else {
      state.favorites.splice(index, 1);
      showToast(from + ' → ' + to + ' eliminado de favoritos.');
    }
    state.favorites = state.favorites.slice(0, 30);
    writeJSON(STORAGE.favorites, state.favorites);
    renderFavorites();
    renderCompare();
  }

  function renderCompare() {
    var base = validCurrency(state.compare.base) ? state.compare.base : state.from;
    state.compare.base = base;
    if (document.activeElement !== el.compareAmount) {
      el.compareAmount.value = Number.isFinite(Number(state.compare.amount))
        ? F.formatNumber(state.compare.amount, { maximumFractionDigits: 2 })
        : '';
    }
    el.compareBase.value = base;

    var amount = Number(state.compare.amount);
    var query = normalizeSearch(state.compare.search);
    var all = Divisa.CURRENCIES.filter(function (currency) {
      return currency.code !== base;
    });

    if (state.compare.favOnly) {
      all = all.filter(function (currency) {
        return isFavorite(base, currency.code);
      });
    }

    var matching = all.filter(function (currency) {
      if (!query) return true;
      return normalizeSearch(currency.code + ' ' + currency.name).indexOf(query) !== -1;
    });

    var visible = state.compare.all ? matching : matching.slice(0, 8);
    el.compareBody.innerHTML = visible.map(function (currency) {
      var rate = tradeRate(base, currency.code);
      var converted = Number.isFinite(amount) ? amount * rate : NaN;
      var favorite = isFavorite(base, currency.code);
      return '<tr data-compare-code="' + currency.code + '">' +
        '<td><div class="curr-cell"><span class="curr-flag" aria-hidden="true">' +
        currency.flag + '</span><div class="curr-meta"><span class="curr-code">' +
        currency.code + '</span><span class="curr-name">' + escapeHtml(currency.name) +
        '</span></div></div></td>' +
        '<td class="num">' + F.formatRate(rate) + '</td>' +
        '<td class="text-end curr-amount">' + F.formatMoney(converted, currency.code) + '</td>' +
        '<td class="text-end"><div class="table-actions">' +
        '<button type="button" class="icon-btn' + (favorite ? ' is-active' : '') +
        '" data-compare-fav="' + currency.code + '" aria-label="' +
        (favorite ? 'Quitar de favoritos' : 'Guardar en favoritos') + '" aria-pressed="' +
        favorite + '">' + starIcon() + '</button>' +
        '<button type="button" class="icon-btn" data-compare-use="' + currency.code +
        '" aria-label="Usar ' + currency.code + ' como destino">' + arrowIcon() + '</button>' +
        '</div></td></tr>';
    }).join('');

    el.compareEmpty.hidden = visible.length > 0;
    if (!visible.length) {
      el.compareEmpty.textContent = state.compare.favOnly
        ? 'No hay pares favoritos para ' + base + ' con este filtro.'
        : 'No hay monedas que coincidan con la búsqueda.';
    }

    var shown = visible.length;
    var total = all.length;
    el.compareCount.textContent = 'Mostrando ' + shown + ' de ' + total +
      ' monedas · base ' + base;
    el.compareToggle.textContent = state.compare.all
      ? 'Ver menos monedas'
      : 'Ver todas las monedas';
  }

  function renderBudget() {
    var foreign = state.to;
    var local = state.from;
    var rate = tradeRate(foreign, local);
    el.budgetPairLabel.textContent = local + ' → ' + foreign;
    el.budgetForeignLabel.textContent = foreign;
    el.budgetLocalLabel.textContent = local;

    var totalForeign = 0;
    var totalLocal = 0;
    var rows = state.budget.map(function (row, index) {
      var parsed = F.parseAmount(row.amount);
      var amount = Number.isFinite(parsed) ? parsed : 0;
      var converted = Number.isFinite(rate) ? amount * rate : NaN;
      totalForeign += amount;
      if (Number.isFinite(converted)) totalLocal += converted;
      return '<tr data-budget-index="' + index + '">' +
        '<td><input class="form-control table-input category" type="text" maxlength="40" ' +
        'data-budget-field="label" value="' + escapeHtml(row.label) + '" aria-label="Categoría"></td>' +
        '<td><input class="form-control table-input amount" type="text" inputmode="decimal" ' +
        'data-budget-field="amount" value="' + escapeHtml(row.amount) + '" aria-label="Importe en ' +
        foreign + '"></td>' +
        '<td class="text-end curr-amount" data-budget-local>' +
        (Number.isFinite(converted) ? F.formatMoney(converted, local) : '—') + '</td>' +
        '<td class="text-end"><div class="table-actions">' +
        '<button type="button" class="icon-btn danger" data-budget-remove="' + index +
        '" aria-label="Eliminar categoría">' + trashIcon() + '</button></div></td>' +
        '</tr>';
    }).join('');

    el.budgetBody.innerHTML = rows;
    el.budgetTotalForeign.textContent = F.formatMoney(totalForeign, foreign);
    el.budgetTotalLocal.textContent = Number.isFinite(rate)
      ? F.formatMoney(totalLocal, local)
      : '—';
  }

  function renderProduct() {
    el.productPairLabel.textContent = state.from + ' → ' + state.to;
    el.productPriceLabel.textContent = state.to;
    el.productShippingLabel.textContent = state.to;

    var price = F.parseAmount(state.product.price);
    var shipping = F.parseAmount(state.product.shipping);
    var taxPercent = F.parseAmount(state.product.tax);
    var feePercent = F.parseAmount(state.product.fees);
    var rate = tradeRate(state.to, state.from);

    var valid = Number.isFinite(price) && price >= 0 &&
      Number.isFinite(shipping) && shipping >= 0 &&
      Number.isFinite(taxPercent) && taxPercent >= 0 && taxPercent <= 100 &&
      Number.isFinite(feePercent) && feePercent >= 0 && feePercent <= 100;

    if (!valid) {
      el.productError.hidden = false;
      el.productError.textContent = 'Revisa los importes: deben ser números positivos y los porcentajes deben estar entre 0 y 100.';
      ['productSubtotal', 'productShippingLocal', 'productTaxLocal', 'productFeesLocal',
        'productTotalForeign', 'productTotalLocal', 'productRate'].forEach(function (id) {
        el[id].textContent = '—';
      });
      return;
    }

    el.productError.hidden = true;
    var base = price + shipping;
    var tax = base * taxPercent / 100;
    var fees = base * feePercent / 100;
    var totalForeign = base + tax + fees;
    var totalLocal = Number.isFinite(rate) ? totalForeign * rate : NaN;

    el.productSubtotal.textContent = F.formatMoney(price, state.to);
    el.productShippingLocal.textContent = F.formatMoney(shipping, state.to);
    el.productTaxLocal.textContent = F.formatMoney(tax, state.to);
    el.productFeesLocal.textContent = F.formatMoney(fees, state.to);
    el.productTotalForeign.textContent = F.formatMoney(totalForeign, state.to);
    el.productTotalLocal.textContent = F.formatMoney(totalLocal, state.from);
    el.productRate.textContent = '1 ' + state.to + ' = ' +
      F.formatRate(rate) + ' ' + state.from;
  }

  function renderPairCards() {
    var cards = document.querySelectorAll('.pair-card[data-from][data-to]');
    Array.prototype.forEach.call(cards, function (card) {
      var from = card.getAttribute('data-from');
      var to = card.getAttribute('data-to');
      var rate = tradeRate(from, to);
      var label = card.querySelector('.js-pair-rate');
      if (label) {
        label.textContent = '1 ' + from + ' = ' + F.formatRate(rate) + ' ' + to;
      }
    });
  }

  function renderHistory() {
    el.historyCount.textContent = state.history.length + (state.history.length === 1 ? ' registro' : ' registros');
    el.historyEmpty.hidden = state.history.length > 0;

    el.historyBody.innerHTML = state.history.map(function (item, index) {
      return '<tr>' +
        '<td class="time-cell" title="' + escapeHtml(F.formatDateTime(item.at)) + '">' +
        escapeHtml(F.formatTime(item.at)) + '</td>' +
        '<td><div class="history-pair"><strong>' + F.formatMoney(item.amount, item.from) +
        '</strong><span>' + item.from + ' → ' + item.to + '</span></div></td>' +
        '<td class="text-end"><span class="history-result">' +
        F.formatMoney(item.result, item.to) + '</span></td>' +
        '<td class="text-end"><div class="table-actions">' +
        '<button type="button" class="icon-btn" data-history-restore="' + index +
        '" aria-label="Restaurar esta conversión">' + restoreIcon() + '</button>' +
        '<button type="button" class="icon-btn danger" data-history-remove="' + index +
        '" aria-label="Eliminar esta conversión">' + trashIcon() + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function recordHistory() {
    var values = converterValues();
    if (!values || values.amount <= 0) return;
    var item = {
      at: Date.now(),
      from: state.from,
      to: state.to,
      amount: values.amount,
      result: values.netTo
    };
    state.history = state.history.filter(function (existing) {
      return !(existing.from === item.from && existing.to === item.to &&
        Number(existing.amount) === item.amount);
    });
    state.history.unshift(item);
    state.history = state.history.slice(0, CFG.maxHistory);
    writeJSON(STORAGE.history, state.history, true);
    renderHistory();
  }

  function scheduleHistory() {
    global.clearTimeout(historyTimer);
    historyTimer = global.setTimeout(recordHistory, 900);
  }

  function removeHistory(index) {
    if (index < 0 || index >= state.history.length) return;
    state.history.splice(index, 1);
    writeJSON(STORAGE.history, state.history, true);
    renderHistory();
  }

  function restoreHistory(index) {
    var item = state.history[index];
    if (!item) return;
    applyPair(item.from, item.to, { amount: item.amount, scroll: true });
    recordHistory();
    showToast('Conversión restaurada.');
  }

  function starIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  }

  function arrowIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  }

  function restoreIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  }

  function readAmount(showError) {
    var raw = el.amountInput.value;
    var parsed = F.parseAmount(raw);
    var message = '';

    if (!String(raw).trim()) {
      message = 'Escribe una cantidad.';
    } else if (!Number.isFinite(parsed)) {
      message = 'Usa un número válido, por ejemplo 1,234.56 o 1.234,56.';
    } else if (parsed < 0) {
      message = 'La cantidad no puede ser negativa.';
    } else if (parsed > CFG.maxAmount) {
      message = 'La cantidad es demasiado grande.';
    }

    if (message) {
      state.amount = NaN;
    } else {
      state.amount = parsed;
    }

    if (showError) {
      el.amountError.hidden = !message;
      el.amountError.textContent = message;
      el.amountInput.setAttribute('aria-invalid', message ? 'true' : 'false');
    } else if (!message) {
      el.amountError.hidden = true;
      el.amountInput.setAttribute('aria-invalid', 'false');
    }

    return { value: parsed, error: message };
  }

  function updateChartLabels() {
    var rate = tradeRate(state.from, state.to);
    el.chartPairLabel.textContent = state.from + ' → ' + state.to;
    el.chartRateLabel.textContent = '1 ' + state.from + ' = ' +
      F.formatRate(rate) + ' ' + state.to;
  }

  function setChartPeriod(days, reload) {
    state.chart.days = days;
    var buttons = document.querySelectorAll('.period-btn[data-days]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.classList.toggle('is-active', Number(button.getAttribute('data-days')) === days);
    });
    if (reload !== false) loadChart();
  }

  function clearChartStats() {
    ['chartMin', 'chartMax', 'chartAvg', 'chartChange'].forEach(function (id) {
      el[id].textContent = '—';
    });
    el.chartTableBody.innerHTML = '';
    el.chartSource.textContent = 'Fuente: Frankfurter · BCE';
    el.chartUpdated.textContent = '—';
  }

  function destroyChart() {
    if (el.rateChart._divisaChart) {
      if (Divisa.chart) Divisa.chart.destroy(el.rateChart._divisaChart);
      else el.rateChart._divisaChart.destroy();
      el.rateChart._divisaChart = null;
    }
  }

  function showChartEmpty(title, text) {
    destroyChart();
    el.rateChart.hidden = true;
    el.chartEmpty.hidden = false;
    el.chartEmptyTitle.textContent = title;
    el.chartEmptyText.textContent = text;
    clearChartStats();
  }

  function renderChartStats(data) {
    var points = data.points;
    var values = points.map(function (point) { return point.rate; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    var average = total / values.length;
    var first = values[0];
    var last = values[values.length - 1];
    var change = first > 0 ? ((last - first) / first) * 100 : 0;

    el.chartMin.textContent = F.formatRate(min);
    el.chartMax.textContent = F.formatRate(max);
    el.chartAvg.textContent = F.formatRate(average);
    el.chartChange.textContent = (change > 0 ? '+' : change < 0 ? '−' : '') +
      F.formatPercent(Math.abs(change), 2);
    el.chartChange.title = 'Variación entre el primer y el último dato del periodo';

    el.chartTableBody.innerHTML = points.slice(-16).reverse().map(function (point) {
      return '<tr><td>' + F.formatDateShort(point.date) + '</td>' +
        '<td class="text-end">' + F.formatRate(point.rate) + '</td></tr>';
    }).join('');

    el.chartSource.textContent = 'Fuente: ' + data.source + ' · ' +
      points.length + (points.length === 1 ? ' punto' : ' puntos');
    el.chartUpdated.textContent = 'Consultado ' + F.formatDateTime(data.fetchedAt);
  }

  function chartErrorMessage(error) {
    if (!error) return 'No hay información disponible para este par.';
    if (error.code === 'UNSUPPORTED') {
      return 'La fuente histórica del BCE no cubre una de las monedas del par. Prueba con USD, EUR, MXN, GBP o JPY.';
    }
    if (error.code === 'NO_DATA') {
      return 'No hay datos para este par en el periodo seleccionado. Prueba con otro rango de fechas.';
    }
    if (error.code === 'TIMEOUT') {
      return 'La consulta tardó demasiado. Revisa tu conexión e inténtalo de nuevo.';
    }
    return error.message || 'No se pudo consultar el histórico.';
  }

  function loadChart() {
    var requestId = state.chart.requestId + 1;
    state.chart.requestId = requestId;
    state.chart.loading = true;
    updateChartLabels();
    setChartPeriod(state.chart.days, false);
    el.chartLoading.hidden = false;
    el.chartEmpty.hidden = true;

    var from = state.from;
    var to = state.to;
    var days = state.chart.days;

    if (!Divisa.HISTORY_SUPPORTED.has(from) || !Divisa.HISTORY_SUPPORTED.has(to)) {
      state.chart.loading = false;
      el.chartLoading.hidden = true;
      showChartEmpty(
        'Histórico no disponible',
        'La fuente del Banco Central Europeo no cubre ' + (
          !Divisa.HISTORY_SUPPORTED.has(from) ? from : to
        ) + '. Puedes seguir usando el conversor con los tipos actuales.'
      );
      return;
    }

    API.fetchHistory(from, to, days).then(function (data) {
      if (requestId !== state.chart.requestId) return;
      state.chart.loading = false;
      state.chart.data = data;
      el.chartLoading.hidden = true;

      if (!data || !data.points || !data.points.length) {
        showChartEmpty(
          'Sin datos históricos',
          'No hay información disponible para ' + from + ' → ' + to + ' en este periodo.'
        );
        return;
      }

      el.chartEmpty.hidden = true;
      el.rateChart.hidden = false;
      renderChartStats(data);
      if (Divisa.chart) {
        Divisa.chart.create(el.rateChart, data.points, { from: from, to: to });
      }
    }).catch(function (error) {
      if (requestId !== state.chart.requestId) return;
      state.chart.loading = false;
      state.chart.data = null;
      el.chartLoading.hidden = true;
      var code = error && error.code;
      var title = code === 'UNSUPPORTED'
        ? 'Histórico no disponible'
        : code === 'NO_DATA'
          ? 'Sin datos históricos'
          : 'No se pudo cargar el histórico';
      showChartEmpty(title, chartErrorMessage(error));
    });
  }

  function renderTicker() {
    updateChartLabels();
    el.tickerGroup.innerHTML = Divisa.TICKER_PAIRS.map(function (pair) {
      var from = pair[0];
      var to = pair[1];
      return '<span>' + from + '/' + to + ' <b>' + F.formatRate(tradeRate(from, to)) +
        '</b></span><i aria-hidden="true"></i>';
    }).join('');

    while (el.tickerTrack.children.length > 1) {
      el.tickerTrack.removeChild(el.tickerTrack.lastElementChild);
    }

    var clone = el.tickerGroup.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    el.tickerTrack.appendChild(clone);
  }

  function renderAffiliates() {
    if (!Divisa.AFFILIATES_ENABLED || !Divisa.AFFILIATES.length) {
      el.afiliados.hidden = true;
      return;
    }
    el.afiliados.hidden = false;
    el.affiliateGrid.innerHTML = Divisa.AFFILIATES.map(function (item) {
      return '<article class="affiliate-card">' +
        '<span class="mono-tag">Publicidad</span>' +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p>' + escapeHtml(item.text) + '</p>' +
        '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(item.url) +
        '" rel="sponsored noopener" target="_blank">' + escapeHtml(item.cta) + '</a>' +
        '</article>';
    }).join('');
  }

  function loadRates(options) {
    var force = !!(options && options.force);
    var manual = !!(options && options.manual);
    if (state.loadingRates) return Promise.resolve();

    state.loadingRates = true;
    if (el.refreshBtn) el.refreshBtn.classList.add('is-loading');
    renderHeader();

    return API.fetchLatest({ force: force }).then(function (payload) {
      if (payload && payload.rates) state.rates = payload.rates;
      if (payload) state.meta = payload;
      state.loadingRates = false;
      if (el.refreshBtn) el.refreshBtn.classList.remove('is-loading');
      renderAll();
      renderTicker();
      if (manual) {
        showToast(payload && payload.error
          ? 'No se pudo actualizar. Se muestran los datos disponibles.'
          : 'Tipos de cambio actualizados.');
      }
    }).catch(function (error) {
      state.loadingRates = false;
      if (el.refreshBtn) el.refreshBtn.classList.remove('is-loading');
      state.meta = state.meta || {
        base: 'USD',
        rates: state.rates,
        source: 'Respaldo local',
        sourceUrl: null,
        updatedAt: Divisa.SEED_DATE,
        fetchedAt: Date.now(),
        stale: true,
        seed: true,
        error: error
      };
      renderAll();
      renderTicker();
      if (manual) showToast('No se pudieron actualizar los tipos de cambio.');
    });
  }

  function saveFee() {
    writeJSON(STORAGE.fee, state.fee);
  }

  function saveBudget() {
    writeJSON(STORAGE.budget, state.budget, true);
  }

  function saveCompare() {
    writeJSON('divisa:compare', {
      base: state.compare.base,
      amount: state.compare.amount,
      favOnly: state.compare.favOnly,
      all: state.compare.all
    });
  }

  function applyProviderPreset(key) {
    var preset = Divisa.FEE_PRESETS[key];
    if (!preset) return;
    state.provider.preset = key;
    state.provider.name = preset.name;
    state.provider.spread = preset.spread;
    state.provider.commission = preset.commission;
    state.provider.fixed = preset.fixed;
    state.provider.rate = null;
    el.providerName.value = preset.name;
    el.providerSpread.value = preset.spread;
    el.providerCommission.value = preset.commission;
    el.providerFixed.value = preset.fixed;
    el.providerRate.value = '';
    renderProvider();
  }

  function syncFeeFromInputs() {
    state.fee.enabled = el.feeEnabled.checked;
    state.fee.percent = F.clamp(F.readNumber(el.feePercent.value, 0), 0, 100);
    state.fee.fixed = Math.max(0, F.readNumber(el.feeFixed.value, 0));
    saveFee();
    renderConverter();
    renderFees();
  }

  function updateBudgetTotals() {
    var rate = tradeRate(state.to, state.from);
    var totalForeign = 0;
    var totalLocal = 0;
    state.budget.forEach(function (row) {
      var parsed = F.parseAmount(row.amount);
      var amount = Number.isFinite(parsed) ? parsed : 0;
      totalForeign += amount;
      if (Number.isFinite(rate)) totalLocal += amount * rate;
    });
    el.budgetTotalForeign.textContent = F.formatMoney(totalForeign, state.to);
    el.budgetTotalLocal.textContent = Number.isFinite(rate)
      ? F.formatMoney(totalLocal, state.from)
      : '—';
  }

  function handleBudgetInput(event) {
    var input = event.target.closest('[data-budget-field]');
    if (!input) return;
    var rowElement = input.closest('[data-budget-index]');
    if (!rowElement) return;
    var index = Number(rowElement.getAttribute('data-budget-index'));
    var row = state.budget[index];
    if (!row) return;

    var field = input.getAttribute('data-budget-field');
    row[field] = input.value;

    if (field === 'amount') {
      var parsed = F.parseAmount(input.value);
      var rate = tradeRate(state.to, state.from);
      var local = Number.isFinite(parsed) && Number.isFinite(rate) ? parsed * rate : NaN;
      var cell = rowElement.querySelector('[data-budget-local]');
      if (cell) cell.textContent = Number.isFinite(local) ? F.formatMoney(local, state.from) : '—';
    }

    updateBudgetTotals();
    saveBudget();
  }

  function addBudgetRow() {
    state.budget.push({ label: 'Nueva categoría', amount: 0 });
    saveBudget();
    renderBudget();
    var labels = el.budgetBody.querySelectorAll('[data-budget-field="label"]');
    var last = labels[labels.length - 1];
    if (last) {
      last.focus();
      last.select();
    }
  }

  function resetBudget() {
    state.budget = Divisa.DEFAULT_BUDGET.map(function (row) {
      return { label: row.label, amount: row.amount };
    });
    saveBudget();
    renderBudget();
    showToast('Presupuesto restablecido.');
  }

  function copyConversion() {
    var values = converterValues();
    if (!values) {
      showToast('Escribe una cantidad válida para copiar.');
      return;
    }
    var text = F.formatMoney(values.amount, state.from) + ' = ' +
      F.formatMoney(values.netTo, state.to) + ' · 1 ' + state.from + ' = ' +
      F.formatRate(values.rate) + ' ' + state.to;
    copyText(text).then(function () {
      showToast('Conversión copiada al portapapeles.');
    }).catch(function () {
      showToast('No se pudo copiar. Revisa los permisos del navegador.');
    });
  }

  function shareConversion() {
    var values = converterValues();
    if (!values) {
      showToast('Escribe una cantidad válida para compartir.');
      return;
    }
    var text = F.formatMoney(values.amount, state.from) + ' = ' +
      F.formatMoney(values.netTo, state.to) + ' · 1 ' + state.from + ' = ' +
      F.formatRate(values.rate) + ' ' + state.to;
    var url = shareUrl();

    if (global.navigator.share) {
      global.navigator.share({ title: 'Divisa', text: text, url: url }).catch(function () {
        /* cancelado */
      });
      return;
    }

    copyText(text + ' ' + url).then(function () {
      showToast('Enlace copiado al portapapeles.');
    }).catch(function () {
      showToast('No se pudo compartir. Copia el enlace manualmente.');
    });
  }

  function swapCurrencies() {
    applyPair(state.to, state.from, { amount: state.amount, record: true });
  }

  function handleCompareClick(event) {
    var useButton = event.target.closest('[data-compare-use]');
    if (useButton) {
      var code = useButton.getAttribute('data-compare-use');
      applyPair(state.compare.base, code, { amount: state.amount, scroll: true, record: true });
      return;
    }
    var favButton = event.target.closest('[data-compare-fav]');
    if (favButton) {
      toggleFavorite(state.compare.base, favButton.getAttribute('data-compare-fav'));
      return;
    }
    var row = event.target.closest('tr[data-compare-code]');
    if (row) {
      applyPair(state.compare.base, row.getAttribute('data-compare-code'), {
        amount: state.amount,
        scroll: true,
        record: true
      });
    }
  }

  function handleFavoritesClick(event) {
    var removeButton = event.target.closest('[data-fav-remove]');
    if (removeButton) {
      var key = removeButton.getAttribute('data-fav-remove');
      var index = state.favorites.indexOf(key);
      if (index !== -1) {
        state.favorites.splice(index, 1);
        writeJSON(STORAGE.favorites, state.favorites);
        renderFavorites();
        renderCompare();
      }
      return;
    }
    var button = event.target.closest('[data-fav]');
    if (button) {
      var parts = pairParts(button.getAttribute('data-fav'));
      applyPair(parts.from, parts.to, { amount: state.amount, record: true });
    }
  }

  function handleHistoryClick(event) {
    var restoreButton = event.target.closest('[data-history-restore]');
    if (restoreButton) {
      restoreHistory(Number(restoreButton.getAttribute('data-history-restore')));
      return;
    }
    var removeButton = event.target.closest('[data-history-remove]');
    if (removeButton) {
      removeHistory(Number(removeButton.getAttribute('data-history-remove')));
    }
  }

  function bindEvents() {
    el.themeToggle.addEventListener('click', toggleTheme);
    el.swapBtn.addEventListener('click', swapCurrencies);
    el.invertPairBtn.addEventListener('click', swapCurrencies);

    el.converterForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var checked = readAmount(true);
      renderDerived();
      if (!checked.error) recordHistory();
    });

    el.amountInput.addEventListener('input', function () {
      var checked = readAmount(false);
      renderDerived();
      syncUrl();
      if (!checked.error) scheduleHistory();
    });

    el.amountInput.addEventListener('blur', function () {
      readAmount(true);
      renderDerived();
    });

    el.fromSelect.addEventListener('change', function () {
      applyPair(el.fromSelect.value, el.toSelect.value, { record: true });
    });

    el.toSelect.addEventListener('change', function () {
      applyPair(el.fromSelect.value, el.toSelect.value, { record: true });
    });

    el.refreshBtn.addEventListener('click', function () {
      loadRates({ force: true, manual: true });
    });

    el.apiAlertRetry.addEventListener('click', function () {
      loadRates({ force: true, manual: true });
    });

    el.copyBtn.addEventListener('click', copyConversion);
    el.shareBtn.addEventListener('click', shareConversion);
    el.favoriteBtn.addEventListener('click', function () {
      toggleFavorite(state.from, state.to);
    });

    el.feeEnabled.addEventListener('change', syncFeeFromInputs);
    el.feePercent.addEventListener('input', syncFeeFromInputs);
    el.feeFixed.addEventListener('input', syncFeeFromInputs);
    el.feeEditBtn.addEventListener('click', function () {
      el.feeDetails.open = true;
      el.feeDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
      global.setTimeout(function () {
        el.feePercent.focus();
        el.feePercent.select();
      }, 220);
    });

    var quickChips = document.querySelectorAll('.quick-chip[data-amount]');
    Array.prototype.forEach.call(quickChips, function (chip) {
      chip.addEventListener('click', function () {
        setAmount(Number(chip.getAttribute('data-amount')), { record: true });
      });
    });

    var pairButtons = document.querySelectorAll('.js-pair-convert');
    Array.prototype.forEach.call(pairButtons, function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('.pair-card[data-from][data-to]');
        if (!card) return;
        applyPair(card.getAttribute('data-from'), card.getAttribute('data-to'), {
          amount: 1,
          scroll: true,
          record: true
        });
      });
    });

    el.compareAmount.addEventListener('input', function () {
      var parsed = F.parseAmount(el.compareAmount.value);
      state.compare.amount = Number.isFinite(parsed) ? parsed : NaN;
      renderCompare();
      saveCompare();
    });

    el.compareBase.addEventListener('change', function () {
      state.compare.base = el.compareBase.value;
      renderCompare();
      saveCompare();
    });

    el.compareSearch.addEventListener('input', function () {
      state.compare.search = el.compareSearch.value;
      renderCompare();
    });

    el.compareFavOnly.addEventListener('change', function () {
      state.compare.favOnly = el.compareFavOnly.checked;
      renderCompare();
      saveCompare();
    });

    el.compareToggle.addEventListener('click', function () {
      state.compare.all = !state.compare.all;
      renderCompare();
      saveCompare();
    });

    el.compareBody.addEventListener('click', handleCompareClick);
    el.favoritesList.addEventListener('click', handleFavoritesClick);

    el.providerPresets.addEventListener('click', function (event) {
      var button = event.target.closest('[data-preset]');
      if (button) applyProviderPreset(button.getAttribute('data-preset'));
    });

    el.providerName.addEventListener('input', function () {
      state.provider.name = el.providerName.value.slice(0, 40);
    });

    el.providerRate.addEventListener('input', function () {
      setProviderRate(el.providerRate.value);
    });

    [['providerSpread', 'spread'], ['providerCommission', 'commission'],
      ['providerFixed', 'fixed']].forEach(function (pair) {
      var input = el[pair[0]];
      input.addEventListener('input', function () {
        var value = F.readNumber(input.value, 0);
        state.provider[pair[1]] = Math.max(0, value);
        renderProvider();
      });
    });

    var periodButtons = document.querySelectorAll('.period-btn[data-days]');
    Array.prototype.forEach.call(periodButtons, function (button) {
      button.addEventListener('click', function () {
        setChartPeriod(Number(button.getAttribute('data-days')), true);
      });
    });

    el.budgetBody.addEventListener('input', handleBudgetInput);
    el.budgetBody.addEventListener('click', function (event) {
      var button = event.target.closest('[data-budget-remove]');
      if (!button) return;
      var index = Number(button.getAttribute('data-budget-remove'));
      state.budget.splice(index, 1);
      saveBudget();
      renderBudget();
    });
    el.budgetAdd.addEventListener('click', addBudgetRow);
    el.budgetReset.addEventListener('click', resetBudget);

    [['productPrice', 'price'], ['productShipping', 'shipping'],
      ['productTax', 'tax'], ['productFees', 'fees']].forEach(function (pair) {
      var input = el[pair[0]];
      input.addEventListener('input', function () {
        state.product[pair[1]] = input.value;
        renderProduct();
      });
    });

    el.historyClear.addEventListener('click', function () {
      state.history = [];
      writeJSON(STORAGE.history, state.history, true);
      renderHistory();
      showToast('Historial de la sesión borrado.');
    });
    el.historyBody.addEventListener('click', handleHistoryClick);

    global.addEventListener('online', function () {
      renderHeader();
      showToast('Conexión restablecida. Actualizando tipos.');
      loadRates({ force: true });
    });

    global.addEventListener('offline', function () {
      renderHeader();
      showToast('Sin conexión. Se usan los últimos datos guardados.');
    });

    global.setInterval(function () {
      renderHeader();
    }, 60000);

    global.setInterval(function () {
      loadRates({ force: true });
    }, CFG.cacheTtl);
  }

  function init() {
    cacheElements();
    readUrlState();
    loadStoredState();
    populateSelects();
    syncInputs();
    initTheme();
    bindEvents();

    var cached = API.peekCache();
    if (cached && Date.now() - cached.fetchedAt < CFG.cacheTtl) {
      state.rates = cached.rates;
      state.meta = Object.assign({}, cached, {
        stale: false,
        seed: false,
        error: null,
        fromCache: true
      });
    }

    renderAll();
    renderTicker();
    renderAffiliates();
    setChartPeriod(state.chart.days, false);
    loadChart();
    loadRates();
    updateMarketStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

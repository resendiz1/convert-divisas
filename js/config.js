(function (global) {
  'use strict';

  var Divisa = global.Divisa = global.Divisa || {};

  Divisa.CURRENCIES = [
    { code: 'MXN', name: 'Peso mexicano', symbol: '$', flag: '🇲🇽', decimals: 2, history: true },
    { code: 'USD', name: 'Dólar estadounidense', symbol: '$', flag: '🇺🇸', decimals: 2, history: true },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2, history: true },
    { code: 'GBP', name: 'Libra esterlina', symbol: '£', flag: '🇬🇧', decimals: 2, history: true },
    { code: 'JPY', name: 'Yen japonés', symbol: '¥', flag: '🇯🇵', decimals: 0, history: true },
    { code: 'CAD', name: 'Dólar canadiense', symbol: 'C$', flag: '🇨🇦', decimals: 2, history: true },
    { code: 'AUD', name: 'Dólar australiano', symbol: 'A$', flag: '🇦🇺', decimals: 2, history: true },
    { code: 'CHF', name: 'Franco suizo', symbol: 'Fr', flag: '🇨🇭', decimals: 2, history: true },
    { code: 'CNY', name: 'Yuan chino', symbol: '¥', flag: '🇨🇳', decimals: 2, history: true },
    { code: 'BRL', name: 'Real brasileño', symbol: 'R$', flag: '🇧🇷', decimals: 2, history: true },
    { code: 'ARS', name: 'Peso argentino', symbol: '$', flag: '🇦🇷', decimals: 2, history: false },
    { code: 'COP', name: 'Peso colombiano', symbol: '$', flag: '🇨🇴', decimals: 0, history: false },
    { code: 'CLP', name: 'Peso chileno', symbol: '$', flag: '🇨🇱', decimals: 0, history: false },
    { code: 'PEN', name: 'Sol peruano', symbol: 'S/', flag: '🇵🇪', decimals: 2, history: false },
    { code: 'UYU', name: 'Peso uruguayo', symbol: '$U', flag: '🇺🇾', decimals: 2, history: false },
    { code: 'KRW', name: 'Won surcoreano', symbol: '₩', flag: '🇰🇷', decimals: 0, history: true },
    { code: 'INR', name: 'Rupia india', symbol: '₹', flag: '🇮🇳', decimals: 2, history: true },
    { code: 'SGD', name: 'Dólar de Singapur', symbol: 'S$', flag: '🇸🇬', decimals: 2, history: true },
    { code: 'HKD', name: 'Dólar de Hong Kong', symbol: 'HK$', flag: '🇭🇰', decimals: 2, history: true },
    { code: 'NZD', name: 'Dólar neozelandés', symbol: 'NZ$', flag: '🇳🇿', decimals: 2, history: true },
    { code: 'SEK', name: 'Corona sueca', symbol: 'kr', flag: '🇸🇪', decimals: 2, history: true },
    { code: 'NOK', name: 'Corona noruega', symbol: 'kr', flag: '🇳🇴', decimals: 2, history: true },
    { code: 'DKK', name: 'Corona danesa', symbol: 'kr', flag: '🇩🇰', decimals: 2, history: true },
    { code: 'PLN', name: 'Zloty polaco', symbol: 'zł', flag: '🇵🇱', decimals: 2, history: true },
    { code: 'CZK', name: 'Corona checa', symbol: 'Kč', flag: '🇨🇿', decimals: 2, history: true },
    { code: 'ZAR', name: 'Rand sudafricano', symbol: 'R', flag: '🇿🇦', decimals: 2, history: true },
    { code: 'TRY', name: 'Lira turca', symbol: '₺', flag: '🇹🇷', decimals: 2, history: true },
    { code: 'THB', name: 'Baht tailandés', symbol: '฿', flag: '🇹🇭', decimals: 2, history: true },
    { code: 'ILS', name: 'Shekel israelí', symbol: '₪', flag: '🇮🇱', decimals: 2, history: true },
    { code: 'AED', name: 'Dírham emiratí', symbol: 'د.إ', flag: '🇦🇪', decimals: 2, history: false }
  ];

  Divisa.CURRENCY_MAP = Divisa.CURRENCIES.reduce(function (acc, currency) {
    acc[currency.code] = currency;
    return acc;
  }, {});

  Divisa.HISTORY_SUPPORTED = new Set(
    Divisa.CURRENCIES.filter(function (c) { return c.history; }).map(function (c) { return c.code; })
  );

  Divisa.DEFAULT_PAIR = { from: 'MXN', to: 'USD', amount: 100 };

  Divisa.TICKER_PAIRS = [
    ['USD', 'MXN'], ['EUR', 'MXN'], ['GBP', 'MXN'], ['MXN', 'USD'],
    ['USD', 'EUR'], ['EUR', 'GBP'], ['JPY', 'MXN'], ['CAD', 'MXN']
  ];

  Divisa.EQUIVALENCE_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000];

  Divisa.POPULAR_PAIRS = [
    ['MXN', 'USD'], ['USD', 'MXN'], ['EUR', 'MXN'],
    ['USD', 'EUR'], ['GBP', 'MXN'], ['MXN', 'JPY']
  ];

  Divisa.FEE_PRESETS = {
    banco: { name: 'Banco', spread: 1.8, commission: 2.5, fixed: 0 },
    casa: { name: 'Casa de cambio', spread: 1.2, commission: 0, fixed: 0 },
    tarjeta: { name: 'Tarjeta', spread: 2.2, commission: 3, fixed: 0 },
    remesadora: { name: 'Remesadora', spread: 0.8, commission: 0, fixed: 2.99 }
  };

  Divisa.DEFAULT_BUDGET = [
    { label: 'Vuelos', amount: 350 },
    { label: 'Hospedaje', amount: 600 },
    { label: 'Comida', amount: 250 },
    { label: 'Transporte', amount: 120 },
    { label: 'Actividades', amount: 150 },
    { label: 'Compras', amount: 200 },
    { label: 'Emergencias', amount: 100 }
  ];

  Divisa.CONFIG = {
    apiLatest: 'https://open.er-api.com/v6/latest/USD',
    apiHistory: 'https://api.frankfurter.dev/v1',
    latestSource: 'ExchangeRate-API',
    latestSourceUrl: 'https://www.exchangerate-api.com',
    historySource: 'Frankfurter · BCE',
    historySourceUrl: 'https://frankfurter.dev',
    cacheKey: 'divisa:rates:v1',
    cacheTtl: 60 * 60 * 1000,
    historyTtl: 6 * 60 * 60 * 1000,
    fetchTimeout: 12000,
    historyTimeout: 16000,
    maxAmount: 1e15,
    maxHistory: 20
  };

  Divisa.SEED_RATES = {
    USD: 1, MXN: 18.653512, EUR: 0.897215, GBP: 0.751538, JPY: 157.90537,
    CAD: 1.401824, AUD: 1.419838, CHF: 0.82903, CNY: 6.680538, BRL: 5.346831,
    ARS: 1538.4739, COP: 3146.899554, CLP: 984.876485, PEN: 3.450392,
    UYU: 40.180262, KRW: 1340.24082, INR: 95.29615, SGD: 1.28178,
    HKD: 7.845294, NZD: 1.778098, SEK: 9.919159, NOK: 9.281645,
    DKK: 6.714157, PLN: 3.951965, CZK: 21.859416, ZAR: 16.633923,
    TRY: 49.858901, THB: 33.772095, ILS: 3.120508, AED: 3.6725
  };

  Divisa.SEED_DATE = Date.UTC(2026, 9, 29, 0, 2, 31);

  Divisa.AFFILIATES_ENABLED = false;

  Divisa.AFFILIATES = [
    {
      id: 'seguros',
      title: 'Seguro de viaje',
      text: 'Cobertura médica, equipaje y cancelaciones para viajar con tranquilidad.',
      cta: 'Comparar opciones',
      url: '#'
    },
    {
      id: 'vuelos',
      title: 'Vuelos internacionales',
      text: 'Compara tarifas y horarios antes de reservar tu próximo destino.',
      cta: 'Buscar vuelos',
      url: '#'
    },
    {
      id: 'hospedaje',
      title: 'Hospedaje',
      text: 'Hoteles, departamentos y alternativas para cada presupuesto.',
      cta: 'Ver hospedaje',
      url: '#'
    },
    {
      id: 'compras',
      title: 'Compras internacionales',
      text: 'Revisa el costo final de tus compras antes de pagar en otra moneda.',
      cta: 'Preparar compra',
      url: '#'
    }
  ];
})(window);

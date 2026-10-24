"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const calculators = require("../js/calculators.js");
const calculator = require("../js/calculator.js");

function loadHistoryModule({ api, state }) {
  const historyItems = [];
  const historyList = {
    children: historyItems,
    get firstChild() {
      return historyItems[0] || null;
    },
    appendChild(element) {
      historyItems.push(element);
      return element;
    },
    removeChild(element) {
      historyItems.splice(historyItems.indexOf(element), 1);
      return element;
    },
  };
  const clearButton = {
    listeners: {},
    addEventListener(event, callback) {
      this.listeners[event] = callback;
    },
  };
  const document = {
    getElementById(id) {
      return id === "historyList" ? historyList : clearButton;
    },
    createElement() {
      return {
        children: [],
        listeners: {},
        setAttribute() {},
        appendChild(element) {
          this.children.push(element);
        },
        addEventListener(event, callback) {
          this.listeners[event] = callback;
        },
      };
    },
    createTextNode(textContent) {
      return { textContent };
    },
  };
  const window = {
    calculatorState: state,
    EasyCalc: api,
    addEventListener() {},
  };
  const source = fs.readFileSync(path.join(__dirname, "../js/history.js"), "utf8");
  vm.runInNewContext(source, { document, window });
  return { historyItems, historyManager: window.historyManager };
}

test("percent button applies to a calculated result", () => {
  calculator.clear();
  assert.equal(calculator.setExpression("200"), true);
  calculator.calculateResult();
  calculator.handleButton("percent");
  calculator.calculateResult();
  assert.equal(calculator.state.result, "2");
});

test("percent button supports relative percentages in an expression", () => {
  calculator.clear();
  assert.equal(calculator.setExpression("50+10"), true);
  calculator.handleButton("percent");
  calculator.calculateResult();
  assert.equal(calculator.state.result, "55");
});

test("expression validation rejects unmatched closing parentheses", () => {
  assert.equal(calculator.isValidExpression("1)"), false);
  assert.equal(calculator.isValidExpression("(1+2))"), false);
  assert.equal(calculator.isValidExpression("(1+2)"), true);
  assert.equal(calculator.isValidExpression("sin(30)"), true);
});

test("unmatched closing parenthesis does not alter the current expression", () => {
  calculator.clear();
  assert.equal(calculator.setExpression("1"), true);
  calculator.handleButton(")");
  assert.equal(calculator.state.expression, "1");
});

test("negate starts a negative operand after a binary operator", () => {
  calculator.clear();
  assert.equal(calculator.setExpression("5+"), true);
  calculator.negate();
  assert.equal(calculator.state.expression, "5+-");
  calculator.appendValue("2");
  calculator.calculateResult();
  assert.equal(calculator.state.result, "3");
});

test("negate refuses to exceed the expression length limit", () => {
  calculator.clear();
  const expression = "1".repeat(50);
  assert.equal(calculator.setExpression(expression), true);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    calculator.negate();
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calculator.state.expression, expression);
});

test("history restores calculations through the calculator API", () => {
  const state = {
    expression: "5",
    result: "5",
    hasError: false,
    justEvaluated: true,
  };
  const api = {
    setExpression(expression) {
      state.expression = expression;
      state.result = "0";
      state.hasError = false;
      state.justEvaluated = false;
      return true;
    },
  };
  const { historyItems, historyManager } = loadHistoryModule({ api, state });
  historyManager.addEntry("2+3", "5");
  historyItems[0].listeners.click();
  assert.equal(state.expression, "2+3");
  assert.equal(state.result, "0");
  assert.equal(state.justEvaluated, false);
});

test("percentage calculator applies a percentage to positive and negative amounts", () => {
  assert.equal(calculators.calculate("percentage", { amount: "200", percent: "15" }).results[0].value, "30");
  assert.equal(calculators.calculate("percentage", { amount: "-80", percent: "25" }).results[0].value, "-20");
});

test("percentage calculator rejects missing and out-of-range values", () => {
  assert.throws(() => calculators.calculate("percentage", { amount: "", percent: "15" }), /Amount is required/);
  assert.throws(() => calculators.calculate("percentage", { amount: "1", percent: "-1" }), /at least 0/);
  assert.throws(() => calculators.calculate("percentage", { amount: "1e308", percent: "1000000" }), /too large to calculate/);
});

test("fraction calculator simplifies results and handles negative denominators", () => {
  assert.equal(calculators.calculate("fraction", {
    numerator1: "1", denominator1: "2", operation: "+", numerator2: "1", denominator2: "4",
  }).results[0].value, "3 / 4");
  assert.equal(calculators.calculate("fraction", {
    numerator1: "5", denominator1: "-10", operation: "+", numerator2: "0", denominator2: "1",
  }).results[0].value, "-1 / 2");
});

test("fraction calculator rejects zero denominators and division by zero", () => {
  assert.throws(() => calculators.calculate("fraction", {
    numerator1: "1", denominator1: "0", operation: "+", numerator2: "1", denominator2: "2",
  }), /denominator cannot be zero/);
  assert.throws(() => calculators.calculate("fraction", {
    numerator1: "1", denominator1: "2", operation: "/", numerator2: "0", denominator2: "3",
  }), /Cannot divide by a fraction equal to zero/);
});

test("loan calculator handles zero interest and reports payment details", () => {
  const result = calculators.calculate("loan", { principal: "12000", rate: "0", years: "5" });
  assert.equal(result.results[0].value, "200.00");
  assert.equal(result.results[1].value, "12,000.00");
  assert.equal(result.results[2].value, "0.00");
});

test("loan calculator default inputs produce the standard amortized payment", () => {
  const result = calculators.calculate("loan", { principal: "25000", rate: "6.5", years: "5" });
  assert.equal(result.results[0].value, "489.15");
});

test("loan calculator applies the fixed-rate monthly payment formula", () => {
  const result = calculators.calculate("loan", { principal: "12000", rate: "12", years: "1" });
  assert.equal(result.results[0].value, "1,066.19");
  assert.equal(result.results[2].value, "794.23");
});

test("compound growth calculator handles regular compounding and a zero rate", () => {
  const result = calculators.calculate("compound", {
    principal: "1000", rate: "5", years: "10", frequency: "12",
  });
  assert.equal(result.results[0].value, "1,647.01");
  assert.equal(calculators.calculate("compound", {
    principal: "1000", rate: "0", years: "10", frequency: "1",
  }).results[0].value, "1,000.00");
});

test("compound growth calculator rejects non-finite results", () => {
  assert.throws(() => calculators.calculate("compound", {
    principal: "1000000000000", rate: "1000", years: "100", frequency: "365",
  }), /too large to calculate/);
});

test("BMI calculator reports the formula result and a general adult range", () => {
  const result = calculators.calculate("bmi", { weight: "70", height: "170" });
  assert.equal(result.results[0].value, "24.22145329");
  assert.equal(result.results[1].value, "Standard adult range");
  assert.match(result.note, /not a diagnosis/);
});

test("BMI calculator supports pounds and inches with the same standard-unit result", () => {
  const metric = calculators.calculate("bmi", { units: "metric", weight: "70", height: "170" });
  const imperial = calculators.calculate("bmi", { units: "imperial", weight: "154.3236", height: "66.9291" });
  assert.ok(Math.abs(Number(imperial.results[0].value.replaceAll(",", "")) - 24.22145329) < 0.0001);
  assert.equal(imperial.results[1].value, metric.results[1].value);
  assert.match(imperial.formula, /pounds to kilograms and inches to meters/);
});

test("BMI calculator validates imperial measurements and units", () => {
  assert.throws(() => calculators.calculate("bmi", {
    units: "imperial", weight: "1", height: "66",
  }), /Weight must be at least 2.2/);
  assert.throws(() => calculators.calculate("bmi", {
    units: "other", weight: "70", height: "170",
  }), /Choose metric or imperial/);
});

test("unit converter handles length, temperature, and decimal storage units", () => {
  const groups = calculators.unitGroups;
  assert.equal(calculators.convertUnit(1, "mi", "km", groups.length), 1.609344);
  assert.equal(calculators.convertUnit(32, "f", "c", groups.temperature), 0);
  assert.equal(calculators.convertUnit(100, "c", "f", groups.temperature), 212);
  assert.equal(calculators.convertUnit(1, "gb", "mb", groups.data), 1000);
});

test("unit converter rejects units from another measurement category", () => {
  assert.throws(() => calculators.calculate("conversion", {
    category: "length", amount: "1", from: "kg", to: "m",
  }), /valid units/);
  assert.throws(() => calculators.calculate("conversion", {
    category: "temperature", amount: "-300", from: "c", to: "k",
  }), /below absolute zero/);
});

test("calculator API rejects unknown tools", () => {
  assert.throws(() => calculators.calculate("unknown", {}), /Unknown calculator/);
});

test("analytics collects nothing before explicit consent", () => {
  const requests = [];
  const listeners = {};
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  const elements = {
    analyticsConsent: { hidden: true },
    analyticsConsentStatus: { textContent: "" },
    analyticsPreferences: { addEventListener() {} },
    analyticsAccept: { addEventListener(name, callback) { listeners.accept = callback; } },
    analyticsReject: { addEventListener(name, callback) { listeners.reject = callback; } },
  };
  const window = {
    EASYCALC_SUPABASE_CONFIG: {
      url: "https://project.supabase.co",
      publishableKey: "public-test-key",
    },
    localStorage,
    sessionStorage,
    crypto: require("node:crypto").webcrypto,
    navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120" },
    location: { pathname: "/calculators/bmi/", search: "?weight=secret" },
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      return { ok: true, status: 202 };
    },
    addEventListener() {},
    setInterval() { return 1; },
    clearInterval() {},
  };
  const document = { getElementById: (id) => elements[id] || null };
  const source = fs.readFileSync(path.join(__dirname, "../js/analytics.js"), "utf8");
  vm.runInNewContext(source, { window, document, console });

  assert.equal(requests.length, 0);
  assert.equal(elements.analyticsConsent.hidden, false);
  assert.equal(typeof listeners.accept, "function");
});

test("analytics sends only random visitor/session IDs after consent and deletes on withdrawal", async () => {
  const requests = [];
  const listeners = {};
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  const elements = {
    analyticsConsent: { hidden: true },
    analyticsConsentStatus: { textContent: "" },
    analyticsPreferences: { addEventListener() {} },
    analyticsAccept: { addEventListener(name, callback) { listeners.accept = callback; } },
    analyticsReject: { addEventListener(name, callback) { listeners.reject = callback; } },
  };
  const window = {
    EASYCALC_SUPABASE_CONFIG: {
      url: "https://project.supabase.co/",
      publishableKey: "public-test-key",
    },
    localStorage,
    sessionStorage,
    crypto: require("node:crypto").webcrypto,
    navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile" },
    location: { pathname: "/calculators/bmi/", search: "?weight=secret" },
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      return { ok: true, status: 202 };
    },
    addEventListener() {},
    setInterval() { return 1; },
    clearInterval() {},
  };
  const document = { getElementById: (id) => elements[id] || null };
  const source = fs.readFileSync(path.join(__dirname, "../js/analytics.js"), "utf8");
  vm.runInNewContext(source, { window, document, console });

  listeners.accept();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.ok(requests.every(({ url }) => url === "https://project.supabase.co/functions/v1/collect-analytics"));
  for (const { payload } of requests) {
    assert.deepEqual(
      Object.keys(payload).sort(),
      ["action", "session_id", "visitor_id"].sort(),
    );
    assert.equal(payload.action, "start");
    assert.match(payload.visitor_id, /^[0-9a-f-]{36}$/);
    assert.match(payload.session_id, /^[0-9a-f-]{36}$/);
  }

  listeners.reject();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests[1].payload.action, "forget");
  assert.equal(localStorage.getItem("easycalc-analytics-visitor"), null);
  assert.equal(requests.length, 2);
});

test("public homepage count widget requests and renders only the two aggregate counts", async () => {
  const requests = [];
  const activeCount = { textContent: "—" };
  const uniqueCount = { textContent: "—" };
  const status = { textContent: "Live estimate" };
  const elements = {
    activeVisitorCount: activeCount,
    uniqueVisitorCount: uniqueCount,
    visitorCountStatus: status,
  };
  const window = {
    EASYCALC_SUPABASE_CONFIG: {
      url: "https://project.supabase.co",
      publishableKey: "public-test-key",
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return { active_visitors: 3, unique_visitors: 27 };
        },
      };
    },
    setInterval(callback, delay) {
      this.pollingDelay = delay;
      return 1;
    },
  };
  const document = { getElementById: (id) => elements[id] || null };
  const source = fs.readFileSync(path.join(__dirname, "../js/public-counts.js"), "utf8");
  vm.runInNewContext(source, { window, document, console });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://project.supabase.co/rest/v1/rpc/get_analytics_counts");
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {});
  assert.equal(activeCount.textContent, "3");
  assert.equal(uniqueCount.textContent, "27");
  assert.equal(status.textContent, "Live estimate");
  assert.equal(window.pollingDelay, 10_000);
});

test("public homepage count widget reports unavailable counts when the RPC fails", async () => {
  const activeCount = { textContent: "—" };
  const uniqueCount = { textContent: "—" };
  const status = { textContent: "Live estimate" };
  const warnings = [];
  const window = {
    EASYCALC_SUPABASE_CONFIG: {
      url: "https://project.supabase.co",
      publishableKey: "public-test-key",
    },
    fetch: async () => ({ ok: false, status: 503 }),
    setInterval() {},
  };
  const document = {
    hidden: false,
    getElementById(id) {
      return {
        activeVisitorCount: activeCount,
        uniqueVisitorCount: uniqueCount,
        visitorCountStatus: status,
      }[id] || null;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../js/public-counts.js"), "utf8");
  vm.runInNewContext(source, {
    window,
    document,
    console: { warn: (...args) => warnings.push(args) },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(activeCount.textContent, "—");
  assert.equal(uniqueCount.textContent, "—");
  assert.equal(status.textContent, "Counts temporarily unavailable");
  assert.equal(warnings.length, 1);
});

test("public analytics count RPC reveals only aggregate counts, not visitor rows", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202610240001_analytics.sql"), "utf8");
  const publicCountsMigration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202610240002_public_counts.sql"), "utf8");
  const config = fs.readFileSync(path.join(__dirname, "../js/supabase-config.js"), "utf8");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.analytics_admins, public\.analytics_visitors, public\.analytics_sessions\s+from anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.update_analytics_presence[\s\S]*?to service_role/i);
  assert.match(publicCountsMigration, /'unique_visitors', \(select count\(\*\) from public\.analytics_visitors\)/);
  assert.match(publicCountsMigration, /count\(distinct visitor_id\)[\s\S]*?interval '90 seconds'/);
  assert.match(publicCountsMigration, /grant execute on function public\.get_analytics_counts\(\) to anon, authenticated/);
  assert.doesNotMatch(publicCountsMigration, /grant select on public\.analytics_(?:visitors|sessions) to anon/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.analytics_sessions/);
  assert.match(config, /url: "https:\/\/yppcwbjwksssxrbfqsxk\.supabase\.co"/);
  assert.match(config, /publishableKey: "(?:|sb_publishable_[^"]+)"/);
  assert.doesNotMatch(config, /service.role|service_role/i);
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

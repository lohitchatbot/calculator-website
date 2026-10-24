/*
 * Copyright (c) 2026 TrueCalc
 * Licensed under the MIT License
 */

(function (global) {
  "use strict";

  const MAX_EXPRESSION_LENGTH = 50;
  const MAX_FACTORIAL_INPUT = 170;
  const SIGNIFICANT_DIGITS = 12;
  const DECIMAL_PLACES = 10;

  const OPERATORS = ["+", "-", "*", "/", "^"];
  const FUNCTIONS = ["sin", "cos", "tan", "log", "ln", "exp", "sqrt", "cbrt"];
  const CONSTANTS = ["pi", "e"];
  const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

  const calculatorState = {
    expression: "",
    result: "0",
    degreeMode: true,
    hasError: false,
    justEvaluated: false,
  };

  const doc = typeof document !== "undefined" ? document : null;
  const displayEl = doc ? doc.getElementById("display") : null;
  const historyPreviewEl = doc ? doc.getElementById("historyPreview") : null;
  const calculatorFeedbackEl = doc ? doc.getElementById("calculatorFeedback") : null;
  const copyResultBtn = doc ? doc.getElementById("copyResult") : null;
  const modeToggleBtn = doc ? doc.getElementById("modeToggle") : null;

  class CalculatorError extends Error {}

  /* ------------------------------------------------------------------ *
   * Tokenizer
   * ------------------------------------------------------------------ */

  function tokenize(expression) {
    const tokens = [];
    let index = 0;

    while (index < expression.length) {
      const char = expression[index];
      const start = index;

      if (char === " ") {
        index += 1;
        continue;
      }

      if (char >= "0" && char <= "9" || char === ".") {
        let text = "";
        let hasDot = false;
        while (index < expression.length) {
          const current = expression[index];
          if (current === ".") {
            if (hasDot) {
              return { error: "Invalid number" };
            }
            hasDot = true;
            text += current;
            index += 1;
            continue;
          }
          if (current < "0" || current > "9") {
            break;
          }
          text += current;
          index += 1;
        }
        if (!NUMBER_PATTERN.test(text)) {
          return { error: "Invalid number" };
        }
        tokens.push({ type: "number", value: text, start: start, end: index });
        continue;
      }

      if (char >= "a" && char <= "z" || char >= "A" && char <= "Z") {
        let name = "";
        while (index < expression.length) {
          const current = expression[index];
          if (current < "a" || current > "z") {
            if (current < "A" || current > "Z") {
              break;
            }
          }
          name += current;
          index += 1;
        }
        const normalized = name.toLowerCase();
        if (FUNCTIONS.indexOf(normalized) !== -1) {
          tokens.push({ type: "function", value: normalized, start: start, end: index });
        } else if (CONSTANTS.indexOf(normalized) !== -1) {
          tokens.push({ type: "constant", value: normalized, start: start, end: index });
        } else {
          return { error: "Unknown symbol " + name };
        }
        continue;
      }

      if (OPERATORS.indexOf(char) !== -1) {
        tokens.push({ type: "operator", value: char, start: start, end: index + 1 });
        index += 1;
        continue;
      }

      if (char === "(") {
        tokens.push({ type: "lparen", start: start, end: index + 1 });
        index += 1;
        continue;
      }

      if (char === ")") {
        tokens.push({ type: "rparen", start: start, end: index + 1 });
        index += 1;
        continue;
      }

      if (char === "!") {
        tokens.push({ type: "factorial", start: start, end: index + 1 });
        index += 1;
        continue;
      }

      if (char === "%") {
        tokens.push({ type: "percent", start: start, end: index + 1 });
        index += 1;
        continue;
      }

      return { error: "Unexpected character " + char };
    }

    return { tokens };
  }

  /* ------------------------------------------------------------------ *
   * Input guardrails
   * ------------------------------------------------------------------ */

  function canStartValue(token) {
    return (
      token.type === "number" ||
      token.type === "constant" ||
      token.type === "function" ||
      token.type === "lparen"
    );
  }

  // Validates a token stream against the strict input rules.
  // Returns true when the stream can legally be extended.
  function validateTokens(tokens) {
    let state = "empty";
    let balance = 0;

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];

      switch (token.type) {
        case "number":
        case "constant":
          if (state === "value") {
            return false;
          }
          state = "value";
          break;

        case "operator":
          if (token.value === "-") {
            if (state === "unary") {
              return false;
            }
            state = state === "value" ? "operator" : "unary";
          } else {
            if (state !== "value") {
              return false;
            }
            state = "operator";
          }
          break;

        case "function":
          if (state === "value") {
            return false;
          }
          state = "lparen";
          break;

        case "lparen":
          balance += 1;
          state = "lparen";
          break;

        case "rparen":
          if (state !== "value" || balance === 0) {
            return false;
          }
          balance -= 1;
          state = "value";
          break;

        case "factorial":
        case "percent":
          if (state !== "value") {
            return false;
          }
          state = "value";
          break;

        default:
          return false;
      }
    }

    return true;
  }

  function parenBalance(tokens) {
    let balance = 0;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type === "lparen") {
        balance += 1;
      } else if (tokens[i].type === "rparen") {
        balance -= 1;
      }
    }
    return balance;
  }

  function isValidExpression(expression) {
    const result = tokenize(expression);
    if (result.error) {
      return false;
    }
    return validateTokens(result.tokens);
  }

  function isBalanced(expression) {
    const result = tokenize(expression);
    if (result.error) {
      return true;
    }
    return parenBalance(result.tokens) === 0;
  }

  /* ------------------------------------------------------------------ *
   * Evaluation
   * ------------------------------------------------------------------ */

  function factorial(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new CalculatorError("Factorial needs a whole number");
    }
    if (value > MAX_FACTORIAL_INPUT) {
      throw new CalculatorError("Factorial is too large");
    }
    let result = 1;
    for (let i = 2; i <= value; i += 1) {
      result *= i;
    }
    return result;
  }

  function applyFunction(name, argument, degreeMode) {
    const radians = degreeMode ? (argument * Math.PI) / 180 : argument;
    let value;

    switch (name) {
      case "sin":
        value = Math.sin(radians);
        break;
      case "cos":
        value = Math.cos(radians);
        break;
      case "tan":
        value = Math.tan(radians);
        break;
      case "log":
        value = Math.log10(argument);
        break;
      case "ln":
        value = Math.log(argument);
        break;
      case "exp":
        value = Math.exp(argument);
        break;
      case "sqrt":
        value = Math.sqrt(argument);
        break;
      case "cbrt":
        value = Math.cbrt(argument);
        break;
      default:
        throw new CalculatorError("Unknown function " + name);
    }

    if (Number.isNaN(value)) {
      throw new CalculatorError(name + " is undefined for that input");
    }
    if (!Number.isFinite(value)) {
      throw new CalculatorError(name + " is too large");
    }
    return value;
  }

  // Recursive descent parser. Nothing is handed to eval/Function, so the
  // expression can never execute arbitrary code.
  function evaluateTokens(tokens, degreeMode) {
    let position = 0;

    const peek = () => tokens[position];
    const advance = () => tokens[position++];

    function parseExpression() {
      let left = parseTerm();
      while (peek() && peek().type === "operator" && (peek().value === "+" || peek().value === "-")) {
        const operator = advance().value;
        const right = parseTerm();
        if (right.percent) {
          const share = (left.value * right.raw) / 100;
          left = {
            value: operator === "+" ? left.value + share : left.value - share,
            percent: false,
            raw: 0,
          };
        } else {
          left = {
            value: operator === "+" ? left.value + right.value : left.value - right.value,
            percent: false,
            raw: 0,
          };
        }
      }
      return left;
    }

    function parseTerm() {
      let left = parseUnary();
      while (peek() && peek().type === "operator" && (peek().value === "*" || peek().value === "/")) {
        const operator = advance().value;
        const right = parseUnary();
        if (operator === "/") {
          if (right.value === 0) {
            throw new CalculatorError("Cannot divide by zero");
          }
          left = { value: left.value / right.value, percent: false, raw: 0 };
        } else {
          left = { value: left.value * right.value, percent: false, raw: 0 };
        }
      }
      return left;
    }

    function parseUnary() {
      const token = peek();
      if (token && token.type === "operator" && (token.value === "-" || token.value === "+")) {
        advance();
        const operand = parseUnary();
        return {
          value: token.value === "-" ? -operand.value : operand.value,
          percent: operand.percent,
          raw: token.value === "-" ? -operand.raw : operand.raw,
        };
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePostfix();
      const token = peek();
      if (token && token.type === "operator" && token.value === "^") {
        advance();
        const exponent = parseUnary();
        const value = Math.pow(base.value, exponent.value);
        if (!Number.isFinite(value)) {
          throw new CalculatorError("Result is too large");
        }
        return { value: value, percent: false, raw: 0 };
      }
      return base;
    }

    function parsePostfix() {
      let value = parsePrimary();
      for (;;) {
        const token = peek();
        if (!token) {
          break;
        }
        if (token.type === "factorial") {
          advance();
          value = { value: factorial(value.value), percent: false, raw: 0 };
          continue;
        }
        if (token.type === "percent") {
          advance();
          value = { value: value.value / 100, percent: true, raw: value.raw };
          continue;
        }
        if (token.type === "lparen") {
          const factor = parsePrimary();
          value = { value: value.value * factor.value, percent: false, raw: 0 };
          continue;
        }
        break;
      }
      return value;
    }

    function parsePrimary() {
      const token = peek();
      if (!token) {
        throw new CalculatorError("Expression is incomplete");
      }

      if (token.type === "number") {
        advance();
        const value = parseFloat(token.value);
        if (!Number.isFinite(value)) {
          throw new CalculatorError("Invalid number");
        }
        return { value: value, percent: false, raw: value };
      }

      if (token.type === "constant") {
        advance();
        const value = token.value === "pi" ? Math.PI : Math.E;
        return { value: value, percent: false, raw: value };
      }

      if (token.type === "function") {
        advance();
        if (!peek() || peek().type !== "lparen") {
          throw new CalculatorError('Expected "(" after ' + token.value);
        }
        advance();
        const argument = parseExpression();
        if (!peek() || peek().type !== "rparen") {
          throw new CalculatorError('Expected ")" after ' + token.value);
        }
        advance();
        return { value: applyFunction(token.value, argument.value, degreeMode), percent: false, raw: 0 };
      }

      if (token.type === "lparen") {
        advance();
        const inner = parseExpression();
        if (!peek() || peek().type !== "rparen") {
          throw new CalculatorError("Expected closing parenthesis");
        }
        advance();
        return { value: inner.value, percent: inner.percent, raw: inner.raw };
      }

      if (token.type === "operator") {
        return parseUnary();
      }

      throw new CalculatorError("Unexpected symbol");
    }

    const result = parseExpression();
    if (position < tokens.length) {
      throw new CalculatorError("Unexpected symbol");
    }
    if (!Number.isFinite(result.value)) {
      throw new CalculatorError("Result is not a finite number");
    }
    return result.value;
  }

  function roundResult(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return value;
    }
    const normalized = parseFloat(value.toPrecision(SIGNIFICANT_DIGITS));
    if (!Number.isFinite(normalized)) {
      return normalized;
    }
    const rounded = Number(normalized.toFixed(DECIMAL_PLACES));
    if (!Number.isFinite(rounded)) {
      return normalized;
    }
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function formatResult(value) {
    const rounded = roundResult(value);
    if (typeof rounded !== "number" || !Number.isFinite(rounded)) {
      return "Error";
    }
    return String(rounded);
  }

  function evaluateExpression(expression, degreeMode) {
    const parsed = tokenize(expression);
    if (parsed.error) {
      throw new CalculatorError(parsed.error);
    }
    if (!parsed.tokens.length) {
      throw new CalculatorError("Expression is empty");
    }
    if (!validateTokens(parsed.tokens)) {
      throw new CalculatorError("Invalid expression");
    }
    if (parenBalance(parsed.tokens) !== 0) {
      throw new CalculatorError("Unbalanced parentheses");
    }
    return roundResult(evaluateTokens(parsed.tokens, degreeMode));
  }

  /* ------------------------------------------------------------------ *
   * UI
   * ------------------------------------------------------------------ */

  function displayText() {
    if (calculatorState.hasError) {
      return "Error";
    }
    return calculatorState.expression || calculatorState.result || "0";
  }

  function fitDisplayText() {
    if (!displayEl) {
      return;
    }
    displayEl.style.fontSize = "";
    const availableWidth = displayEl.clientWidth;
    let fontSize = Number.parseFloat(global.getComputedStyle(displayEl).fontSize);
    const minimumFontSize = 12;
    while (displayEl.scrollWidth > availableWidth && fontSize > minimumFontSize) {
      fontSize = Math.max(
        minimumFontSize,
        fontSize * Math.max(0.7, availableWidth / displayEl.scrollWidth),
      );
      displayEl.style.fontSize = `${fontSize}px`;
    }
    displayEl.scrollLeft = displayEl.scrollWidth;
  }

  function updateDisplay() {
    if (!displayEl) {
      return;
    }
    displayEl.textContent = displayText();
    fitDisplayText();
    displayEl.classList.toggle("is-error", calculatorState.hasError);
    displayEl.classList.toggle(
      "is-invalid",
      !calculatorState.hasError && !isBalanced(calculatorState.expression)
    );
  }

  function updatePreview() {
    if (!historyPreviewEl) {
      return;
    }
    if (calculatorState.hasError) {
      historyPreviewEl.textContent = "Error - press any key to start over.";
      return;
    }
    if (!calculatorState.result || calculatorState.result === "0") {
      historyPreviewEl.textContent = "No calculations yet.";
      return;
    }
    historyPreviewEl.textContent = "Last result: " + calculatorState.result;
  }

  function clearFeedback() {
    if (calculatorFeedbackEl) {
      calculatorFeedbackEl.textContent = "";
    }
  }

  function reportBlockedAction(message) {
    if (calculatorFeedbackEl) {
      calculatorFeedbackEl.textContent = message;
    }
    console.warn("Calculator action blocked:", message);
  }

  function setError(message) {
    calculatorState.hasError = true;
    calculatorState.result = "Error";
    calculatorState.expression = "";
    calculatorState.justEvaluated = false;
    updateDisplay();
    updatePreview();
    if (message) {
      console.warn("Calculator error:", message);
    }
  }

  function clearAll() {
    clearFeedback();
    calculatorState.expression = "";
    calculatorState.result = "0";
    calculatorState.hasError = false;
    calculatorState.justEvaluated = false;
    updateDisplay();
    updatePreview();
  }

  /* ------------------------------------------------------------------ *
   * Input handling
   * ------------------------------------------------------------------ */

  function startsNewCalculation(value) {
    const parsed = tokenize(value);
    if (parsed.error || !parsed.tokens.length) {
      return false;
    }
    return canStartValue(parsed.tokens[0]);
  }

  function appendValue(value) {
    if (typeof value !== "string" || !value) {
      reportBlockedAction("That calculator input is not available.");
      return;
    }

    const recoveringFromError = calculatorState.hasError;
    let expression = recoveringFromError ? "" : calculatorState.expression;
    if (calculatorState.justEvaluated && startsNewCalculation(value)) {
      expression = "";
    }

    if (expression.length + value.length > MAX_EXPRESSION_LENGTH) {
      reportBlockedAction("The expression is too long. Clear it or calculate a shorter expression.");
      return;
    }

    const candidate = expression + value;
    if (!isValidExpression(candidate)) {
      reportBlockedAction("That input is not valid here.");
      return;
    }

    if (recoveringFromError) {
      calculatorState.result = "0";
      calculatorState.hasError = false;
    }
    calculatorState.expression = candidate;
    calculatorState.justEvaluated = false;
    clearFeedback();
    updateDisplay();
  }

  function backspace() {
    if (calculatorState.hasError) {
      clearAll();
      return;
    }
    if (calculatorState.justEvaluated) {
      calculatorState.justEvaluated = false;
      calculatorState.expression = "";
      calculatorState.result = "0";
      clearFeedback();
      updateDisplay();
      updatePreview();
      return;
    }
    if (!calculatorState.expression) {
      reportBlockedAction("There is nothing to delete.");
      return;
    }

    const expression = calculatorState.expression;
    const trailingName = expression.match(/[a-zA-Z]+$/);
    if (trailingName) {
      calculatorState.expression = expression.slice(0, expression.length - trailingName[0].length);
    } else {
      calculatorState.expression = expression.slice(0, -1);
    }
    clearFeedback();
    updateDisplay();
  }

  // A minus sign is unary when it starts the expression or follows another
  // operator or an opening parenthesis.
  function isUnaryMinus(tokens, index) {
    if (!tokens[index] || tokens[index].type !== "operator" || tokens[index].value !== "-") {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const previous = tokens[index - 1];
    return previous.type === "operator" || previous.type === "lparen" || previous.type === "function";
  }

  function negate() {
    if (calculatorState.hasError) {
      clearAll();
      return;
    }

    const expression = calculatorState.expression;
    if (!expression) {
      calculatorState.expression = "-";
      calculatorState.justEvaluated = false;
      clearFeedback();
      updateDisplay();
      return;
    }

    const parsed = tokenize(expression);
    if (parsed.error || !parsed.tokens.length) {
      reportBlockedAction("The current expression cannot be changed yet.");
      return;
    }

    const tokens = parsed.tokens;
    const last = tokens[tokens.length - 1];
    let next = expression;

    if (last.type === "number" || last.type === "constant") {
      const before = expression.slice(0, last.start);
      const isUnary = before.slice(-1) === "-" && (before.length === 1 || "+-*/^(^".indexOf(before.slice(-2, -1)) !== -1);
      next = isUnary ? before.slice(0, -1) + expression.slice(last.start) : before + "-" + expression.slice(last.start);
    } else if (last.type === "operator") {
      if (isUnaryMinus(tokens, tokens.length - 1)) {
        next = expression.slice(0, last.start);
      } else {
        next = expression + "-";
      }
    } else if (last.type === "rparen" || last.type === "factorial" || last.type === "percent") {
      next = expression + "-";
    } else {
      next = expression + "-";
    }

    if (next.length > MAX_EXPRESSION_LENGTH) {
      reportBlockedAction("The expression is too long. Clear it or calculate a shorter expression.");
      return;
    }
    if (!isValidExpression(next)) {
      reportBlockedAction("The sign cannot be changed at this point in the expression.");
      return;
    }

    calculatorState.expression = next;
    calculatorState.justEvaluated = false;
    clearFeedback();
    updateDisplay();
  }

  function calculateResult() {
    if (calculatorState.hasError) {
      clearAll();
      return;
    }

    if (calculatorState.justEvaluated) {
      reportBlockedAction("This result has already been calculated.");
      return;
    }

    const expression = calculatorState.expression;
    if (!expression) {
      reportBlockedAction("Enter a calculation before pressing equals.");
      return;
    }

    let value;
    try {
      value = evaluateExpression(expression, calculatorState.degreeMode);
    } catch (error) {
      setError(error instanceof CalculatorError ? error.message : "Invalid expression");
      return;
    }

    const result = formatResult(value);
    calculatorState.result = result;
    calculatorState.expression = result;
    calculatorState.hasError = false;
    calculatorState.justEvaluated = true;
    clearFeedback();

    if (global && global.historyManager && typeof global.historyManager.addEntry === "function") {
      global.historyManager.addEntry(expression, result);
    }
    updateDisplay();
    updatePreview();
  }

  function handleButton(value) {
    switch (value) {
      case "clear":
        clearAll();
        return;
      case "backspace":
        backspace();
        return;
      case "negate":
        negate();
        return;
      case "=":
        calculateResult();
        return;
      case "percent":
        if (calculatorState.justEvaluated) {
          calculatorState.justEvaluated = false;
        }
        appendValue("%");
        return;
      default:
        if (!value) {
          reportBlockedAction("That calculator button is not available.");
          return;
        }
        appendValue(value);
    }
  }

  function toggleMode() {
    calculatorState.degreeMode = !calculatorState.degreeMode;
    clearFeedback();
    if (modeToggleBtn) {
      modeToggleBtn.textContent = calculatorState.degreeMode ? "Deg" : "Rad";
      modeToggleBtn.setAttribute("aria-label", calculatorState.degreeMode ? "Angle mode: degrees" : "Angle mode: radians");
    }
  }

  function copyResult() {
    if (calculatorState.hasError) {
      reportBlockedAction("There is no result to copy while the display shows an error.");
      return;
    }
    const text = calculatorState.result;
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      clearFeedback();
      global.navigator.clipboard.writeText(text).catch((error) => {
        reportBlockedAction("Could not copy the result. Check your browser's clipboard permission.");
        console.error("Failed to copy result:", error);
      });
      return;
    }
    reportBlockedAction("Clipboard access is not available in this browser context.");
  }

  function setExpression(expression) {
    const value = typeof expression === "string" ? expression : "";
    if (value && !isValidExpression(value)) {
      reportBlockedAction("That expression is not valid.");
      return false;
    }
    clearFeedback();
    calculatorState.expression = value;
    calculatorState.result = "0";
    calculatorState.hasError = false;
    calculatorState.justEvaluated = false;
    updateDisplay();
    updatePreview();
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  const KEY_VALUES = {
    Enter: "=",
    "=": "=",
    "%": "percent",
    "!": "!",
    "(": "(",
    ")": ")",
    "^": "^",
    p: "pi",
    P: "pi",
    e: "e",
    E: "e",
  };

  function attachCalculatorEvents() {
    if (!doc) {
      return;
    }

    doc.querySelectorAll(".btn").forEach((button) => {
      button.addEventListener("click", () => handleButton(button.dataset.value));
    });

    if (copyResultBtn) {
      copyResultBtn.addEventListener("click", copyResult);
    }

    if (global.ResizeObserver && displayEl && displayEl.parentElement) {
      new global.ResizeObserver(fitDisplayText).observe(displayEl.parentElement);
    } else if (global.addEventListener) {
      global.addEventListener("resize", fitDisplayText);
    }
    if (modeToggleBtn) {
      modeToggleBtn.addEventListener("click", toggleMode);
    }

    doc.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const key = event.key;
      if (/^[0-9.+\-*/]$/.test(key)) {
        handleButton(key);
        event.preventDefault();
        return;
      }
      if (Object.prototype.hasOwnProperty.call(KEY_VALUES, key)) {
        handleButton(KEY_VALUES[key]);
        event.preventDefault();
        return;
      }
      if (key === "Backspace") {
        backspace();
        event.preventDefault();
        return;
      }
      if (key === "Escape" || key === "Delete") {
        clearAll();
        event.preventDefault();
      }
    });
  }

  function init() {
    updateDisplay();
    updatePreview();
    attachCalculatorEvents();
    if (modeToggleBtn) {
      modeToggleBtn.textContent = calculatorState.degreeMode ? "Deg" : "Rad";
    }
  }

  const api = {
    state: calculatorState,
    tokenize: tokenize,
    validateTokens: validateTokens,
    evaluateExpression: evaluateExpression,
    evaluateTokens: function (tokens, degreeMode) {
      return evaluateTokens(tokens, degreeMode === undefined ? calculatorState.degreeMode : degreeMode);
    },
    isValidExpression: isValidExpression,
    isBalanced: isBalanced,
    roundResult: roundResult,
    formatResult: formatResult,
    appendValue: appendValue,
    handleButton: handleButton,
    calculateResult: calculateResult,
    clear: clearAll,
    backspace: backspace,
    negate: negate,
    setExpression: setExpression,
    toggleMode: toggleMode,
    init: init,
  };

  if (global) {
    global.calculatorState = calculatorState;
    global.TrueCalc = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (doc) {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);

const calculatorState = {
  expression: "",
  result: "0",
  degreeMode: true,
};

const displayEl = document.getElementById("display");
const historyPreviewEl = document.getElementById("historyPreview");
const copyResultBtn = document.getElementById("copyResult");
const modeToggleBtn = document.getElementById("modeToggle");

function updateDisplay() {
  if (displayEl) {
    displayEl.textContent = calculatorState.expression || calculatorState.result || "0";
  }
}

function updatePreview() {
  if (historyPreviewEl) {
    historyPreviewEl.textContent = calculatorState.result === "0"
      ? "No calculations yet."
      : `Last result: ${calculatorState.result}`;
  }
}

function appendValue(value) {
  const lastChar = calculatorState.expression.slice(-1);

  if (value === "pi") {
    calculatorState.expression += "π";
  } else if (value === "e") {
    calculatorState.expression += "e";
  } else if (value === "sqrt(") {
    calculatorState.expression += "√";
  } else if (value === "cbrt(") {
    calculatorState.expression += "∛";
  } else if (value === "^2") {
    calculatorState.expression += "²";
  } else if (value === "^3") {
    calculatorState.expression += "³";
  } else if (value === "^") {
    calculatorState.expression += "^";
  } else {
    calculatorState.expression += value;
  }

  if (/[+\-*/]$/.test(lastChar) && value === "0") {
    calculatorState.expression = calculatorState.expression.slice(0, -1);
  }

  updateDisplay();
}

function clearExpression() {
  calculatorState.expression = "";
  calculatorState.result = "0";
  updateDisplay();
  updatePreview();
}

function backspace() {
  calculatorState.expression = calculatorState.expression.slice(0, -1);
  updateDisplay();
}

function negate() {
  if (!calculatorState.expression) {
    calculatorState.expression = "-";
  } else if (/^-/.test(calculatorState.expression)) {
    calculatorState.expression = calculatorState.expression.slice(1);
  } else {
    calculatorState.expression = `-${calculatorState.expression}`;
  }
  updateDisplay();
}

function sanitizeExpression(rawExpression) {
  return rawExpression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "Math.PI")
    .replace(/e/g, "Math.E")
    .replace(/√/g, "sqrt")
    .replace(/∛/g, "cbrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/%/g, "/100")
    .replace(/\^/g, "**")
    .replace(/sin\(/g, "sinDeg(")
    .replace(/cos\(/g, "cosDeg(")
    .replace(/tan\(/g, "tanDeg(")
    .replace(/asin\(/g, "asinDeg(")
    .replace(/acos\(/g, "acosDeg(")
    .replace(/atan\(/g, "atanDeg(")
    .replace(/log\(/g, "log10(")
    .replace(/ln\(/g, "lnMath(")
    .replace(/exp\(/g, "expMath(")
    .replace(/sqrt\(/g, "sqrtMath(")
    .replace(/cbrt\(/g, "cbrtMath(");
}

function factorial(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return NaN;
  }
  if (num === 0 || num === 1) {
    return 1;
  }
  let result = 1;
  for (let i = 2; i <= num; i += 1) {
    result *= i;
  }
  return result;
}

function evaluateExpression(expression) {
  const prepared = sanitizeExpression(expression);
  const body = `return (${prepared});`;

  const evaluator = new Function(
    "Math",
    "factorial",
    "sinDeg",
    "cosDeg",
    "tanDeg",
    "asinDeg",
    "acosDeg",
    "atanDeg",
    "log10",
    "lnMath",
    "expMath",
    "sqrtMath",
    "cbrtMath",
    body
  );

  const degreeFactor = calculatorState.degreeMode ? Math.PI / 180 : 1;
  const trig = {
    sinDeg: (value) => Math.sin(value * degreeFactor),
    cosDeg: (value) => Math.cos(value * degreeFactor),
    tanDeg: (value) => Math.tan(value * degreeFactor),
    asinDeg: (value) => Math.asin(value) / degreeFactor,
    acosDeg: (value) => Math.acos(value) / degreeFactor,
    atanDeg: (value) => Math.atan(value) / degreeFactor,
  };

  const result = evaluator(
    Math,
    factorial,
    trig.sinDeg,
    trig.cosDeg,
    trig.tanDeg,
    trig.asinDeg,
    trig.acosDeg,
    trig.atanDeg,
    Math.log10,
    Math.log,
    Math.exp,
    Math.sqrt,
    Math.cbrt
  );

  return Number.isFinite(result) ? result : "Error";
}

function calculateResult() {
  if (!calculatorState.expression) {
    return;
  }

  const safeExpression = calculatorState.expression.replace(/!+/g, "!");
  const result = evaluateExpression(safeExpression);
  calculatorState.result = typeof result === "number" ? result.toString() : result;
  calculatorState.expression = calculatorState.result;
  if (typeof window !== "undefined" && window.historyManager) {
    window.historyManager.addEntry(safeExpression, calculatorState.result);
  }
  updateDisplay();
  updatePreview();
}

function handleButton(value) {
  if (value === "clear") {
    clearExpression();
    return;
  }
  if (value === "backspace") {
    backspace();
    return;
  }
  if (value === "negate") {
    negate();
    return;
  }
  if (value === "=") {
    calculateResult();
    return;
  }
  if (value === "percent") {
    calculatorState.expression += "%";
  } else {
    appendValue(value);
  }
  updateDisplay();
}

function toggleMode() {
  calculatorState.degreeMode = !calculatorState.degreeMode;
  modeToggleBtn.textContent = calculatorState.degreeMode ? "Deg" : "Rad";
}

function copyResult() {
  if (navigator.clipboard && calculatorState.result) {
    navigator.clipboard.writeText(calculatorState.result);
  }
}

function attachCalculatorEvents() {
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("click", () => handleButton(button.dataset.value));
  });

  if (copyResultBtn) {
    copyResultBtn.addEventListener("click", copyResult);
  }

  if (modeToggleBtn) {
    modeToggleBtn.addEventListener("click", toggleMode);
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key;
    if (/^[0-9.+\-*/]$/.test(key)) {
      handleButton(key);
      event.preventDefault();
    } else if (key === "Enter") {
      calculateResult();
      event.preventDefault();
    } else if (key === "Backspace") {
      backspace();
      event.preventDefault();
    } else if (key === "Escape") {
      clearExpression();
      event.preventDefault();
    } else if (key === "%") {
      handleButton("percent");
      event.preventDefault();
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  updateDisplay();
  updatePreview();
  attachCalculatorEvents();
  if (modeToggleBtn) {
    modeToggleBtn.textContent = calculatorState.degreeMode ? "Deg" : "Rad";
  }
});

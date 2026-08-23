(function() {
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
      let displayText = calculatorState.expression || calculatorState.result || "0";

      // Add ellipsis indicator if text is truncated due to character limit
      if (displayText.length > 25) {
        displayText = displayText.substring(0, 22) + "...";
      }

      displayEl.textContent = displayText;
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
    const expr = calculatorState.expression;
    const lastChar = expr.slice(-1);
    const operators = ["+", "-", "*", "/"];
    const isOperator = operators.includes(value);

    if (calculatorState.result === "Error") {
      calculatorState.result = "0";
      calculatorState.expression = "";
    }

    if (expr.length >= 50) {
      return;
    }

    if (isOperator && operators.includes(lastChar)) {
      return;
    }

    if (value === ".") {
      const lastNumber = expr.split(/[\+\-\*\/]/).pop();
      if (lastNumber.includes(".")) {
        return;
      }
    }

    calculatorState.expression += value;
    updateDisplay();
  }
  function extractLastNumber(expr) {
    // Extract the last number from the expression (for decimal validation)
    const numberMatch = expr.match(/([\d]+(?:\.[\d]+)?)(?!\d)/g);
    return numberMatch ? numberMatch[numberMatch.length - 1] || "" : "";
  }
  function roundResult(value) {
    if (typeof value !== "number" || !isFinite(value)) {
      return value;
    }
    return parseFloat(value.toPrecision(15));
  }
  function validateParenthesesBalance(expression) {
    // Check for matching parentheses
    let balance = 0;
    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];
      if (char === "(") {
        balance++;
      } else if (char === ")") {
        balance--;
        if (balance < 0) return false; // Too many closing parentheses
      }
    }
    return balance === 0; // Must have matching parentheses
  }
  function clearExpression() {
    calculatorState.expression = "";
    calculatorState.result = "0";
    updateDisplay();
    updatePreview();
  }
  function handleButtonErrorRecovery() {
    // Handle error state recovery when user interacts with "Error"
    if (calculatorState.result === "Error" && calculatorState.expression) {
      // If "Error" is displayed but there's still an expression, clear everything
      calculatorState.expression = "";
      calculatorState.result = "0";
      updateDisplay();
      updatePreview();
      return true;
    }
    return false;
  }
  function backspace() {
    calculatorState.expression = calculatorState.expression.slice(0, -1);
    updateDisplay();
  }
  function negate() {
    const expr = calculatorState.expression;
    if (!expr) {
      calculatorState.expression = "-";
      updateDisplay();
      return;
    }

    // Find the last number in the expression
    const lastDigitMatch = expr.match(/[\d.]\s*$/);
    if (!lastDigitMatch) {
      // If expression doesn't end in a number (e.g., "5 + "),
      // we just negate the whole thing or add a minus
      calculatorState.expression = expr.startsWith("-") ? expr.slice(1) : "-" + expr;
      updateDisplay();
      return;
    }

    // Find the start of the last number
    let i = expr.length - 1;
    while (i >= 0 && /[\d.]/.test(expr[i])) {
      i--;
    }

    // Now expr[i+1...end] is the last number.
    // Check if there's a minus sign immediately before it.
    const beforeNumber = expr.slice(0, i + 1).trimEnd();
    if (beforeNumber.endsWith("-")) {
      // Remove the minus sign
      const startOfMinus = beforeNumber.lastIndexOf("-");
      calculatorState.expression = expr.slice(0, startOfMinus) + expr.slice(i + 1);
    } else {
      // Add a minus sign
      calculatorState.expression = expr.slice(0, i + 1) + "-" + expr.slice(i + 1);
    }

    updateDisplay();
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
    try {
      const sanitizedExpression = expression.replace(/%/g, '/100');
      const result = math.evaluate(sanitizedExpression);
      if (!Number.isFinite(result)) {
        return "Error: Invalid expression";
      }
      return roundResult(result);
    } catch (e) {
      if (e.message.includes("Division by zero")) {
        return "Error: Division by zero";
      }
      return "Error: Invalid expression";
    }
  }
  function calculateResult() {
    if (!calculatorState.expression) {
      return;
    }

    // Validate parentheses balance before evaluation
    if (!validateParenthesesBalance(calculatorState.expression)) {
      calculatorState.result = "Error";
      calculatorState.expression = "";
      updateDisplay();
      updatePreview();
      return;
    }

    const result = evaluateExpression(calculatorState.expression);

    // Apply floating-point precision rounding
    const roundedResult = typeof result === "number" ? roundResult(result) : result;
    calculatorState.result = typeof roundedResult === "number" ? roundedResult.toString() : roundedResult;
    calculatorState.expression = calculatorState.result;
    if (typeof window !== "undefined" && window.historyManager) {
      window.historyManager.addEntry(calculatorState.expression, calculatorState.result);
    }
    updateDisplay();
    updatePreview();
  }
  function handleButton(value) {
    // Handle error state recovery
    if (handleButtonErrorRecovery()) {
      return;
    }

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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(calculatorState.result).catch(err => {
        console.error("Failed to copy result: ", err);
      });
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
})();
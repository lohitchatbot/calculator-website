/*
 * Copyright (c) 2026 EasyCalc
 * Licensed under the MIT License
 */

(function (global) {
  "use strict";

  const UNIT_GROUPS = {
    length: {
      label: "Length",
      units: {
        m: { label: "Meters (m)", factor: 1 },
        km: { label: "Kilometers (km)", factor: 1000 },
        cm: { label: "Centimeters (cm)", factor: 0.01 },
        mm: { label: "Millimeters (mm)", factor: 0.001 },
        mi: { label: "Miles (mi)", factor: 1609.344 },
        yd: { label: "Yards (yd)", factor: 0.9144 },
        ft: { label: "Feet (ft)", factor: 0.3048 },
        in: { label: "Inches (in)", factor: 0.0254 },
      },
    },
    weight: {
      label: "Weight",
      units: {
        kg: { label: "Kilograms (kg)", factor: 1 },
        g: { label: "Grams (g)", factor: 0.001 },
        mg: { label: "Milligrams (mg)", factor: 0.000001 },
        lb: { label: "Pounds (lb)", factor: 0.45359237 },
        oz: { label: "Ounces (oz)", factor: 0.028349523125 },
      },
    },
    area: {
      label: "Area",
      units: {
        sqm: { label: "Square meters (m²)", factor: 1 },
        sqkm: { label: "Square kilometers (km²)", factor: 1000000 },
        sqft: { label: "Square feet (ft²)", factor: 0.09290304 },
        acre: { label: "Acres", factor: 4046.8564224 },
        hectare: { label: "Hectares (ha)", factor: 10000 },
      },
    },
    volume: {
      label: "Volume",
      units: {
        l: { label: "Liters (L)", factor: 1 },
        ml: { label: "Milliliters (mL)", factor: 0.001 },
        cubicm: { label: "Cubic meters (m³)", factor: 1000 },
        usgal: { label: "US gallons (gal)", factor: 3.785411784 },
        cup: { label: "US cups", factor: 0.2365882365 },
      },
    },
    temperature: {
      label: "Temperature",
      units: {
        c: { label: "Celsius (°C)" },
        f: { label: "Fahrenheit (°F)" },
        k: { label: "Kelvin (K)" },
      },
    },
    speed: {
      label: "Speed",
      units: {
        mps: { label: "Meters per second (m/s)", factor: 1 },
        kmh: { label: "Kilometers per hour (km/h)", factor: 1 / 3.6 },
        mph: { label: "Miles per hour (mph)", factor: 0.44704 },
        knot: { label: "Knots (kn)", factor: 0.514444 },
      },
    },
    data: {
      label: "Data storage (decimal units)",
      units: {
        b: { label: "Bytes (B)", factor: 1 },
        kb: { label: "Kilobytes (KB)", factor: 1000 },
        mb: { label: "Megabytes (MB)", factor: 1000000 },
        gb: { label: "Gigabytes (GB)", factor: 1000000000 },
        tb: { label: "Terabytes (TB)", factor: 1000000000000 },
      },
    },
    energy: {
      label: "Energy",
      units: {
        j: { label: "Joules (J)", factor: 1 },
        kj: { label: "Kilojoules (kJ)", factor: 1000 },
        cal: { label: "Calories (cal)", factor: 4.184 },
        kcal: { label: "Kilocalories (kcal)", factor: 4184 },
        wh: { label: "Watt-hours (Wh)", factor: 3600 },
        kwh: { label: "Kilowatt-hours (kWh)", factor: 3600000 },
      },
    },
  };

  const definitions = {
    percentage: {
      title: "Percentage calculator",
      description: "Find a percentage of any amount.",
      fields: [
        { name: "amount", label: "Amount", type: "number", value: "200", step: "any" },
        { name: "percent", label: "Percentage (%)", type: "number", value: "15", min: "0", max: "1000000", step: "any" },
      ],
      formula: "Amount × (Percentage ÷ 100)",
      calculate(values) {
        const amount = readNumber(values, "amount", "Amount");
        const percent = readNumber(values, "percent", "Percentage", { min: 0, max: 1000000 });
        const result = amount * (percent / 100);
        if (!Number.isFinite(result)) {
          throw new Error("This percentage produces a value too large to calculate.");
        }
        return {
          results: [{ label: "Result", value: formatNumber(result) }],
          formula: `${formatNumber(amount)} × (${formatNumber(percent)} ÷ 100)`,
        };
      },
    },
    fraction: {
      title: "Fraction calculator",
      description: "Add, subtract, multiply, or divide two fractions.",
      fields: [
        { name: "numerator1", label: "First numerator", type: "number", value: "1", step: "1" },
        { name: "denominator1", label: "First denominator", type: "number", value: "2", step: "1" },
        { name: "operation", label: "Operation", type: "select", value: "+", options: [["+", "Add (+)"], ["-", "Subtract (−)"], ["*", "Multiply (×)"], ["/", "Divide (÷)"]] },
        { name: "numerator2", label: "Second numerator", type: "number", value: "1", step: "1" },
        { name: "denominator2", label: "Second denominator", type: "number", value: "4", step: "1" },
      ],
      formula: "Fractions are combined using a common denominator, then reduced to simplest terms.",
      calculate(values) {
        const n1 = readInteger(values, "numerator1", "First numerator");
        const d1 = readInteger(values, "denominator1", "First denominator");
        const n2 = readInteger(values, "numerator2", "Second numerator");
        const d2 = readInteger(values, "denominator2", "Second denominator");
        const operation = values.operation;
        if (!d1 || !d2) {
          throw new Error("A fraction's denominator cannot be zero.");
        }
        if (operation === "/" && n2 === 0n) {
          throw new Error("Cannot divide by a fraction equal to zero.");
        }

        let numerator;
        let denominator;
        if (operation === "+") {
          numerator = n1 * d2 + n2 * d1;
          denominator = d1 * d2;
        } else if (operation === "-") {
          numerator = n1 * d2 - n2 * d1;
          denominator = d1 * d2;
        } else if (operation === "*") {
          numerator = n1 * n2;
          denominator = d1 * d2;
        } else if (operation === "/") {
          numerator = n1 * d2;
          denominator = d1 * n2;
        } else {
          throw new Error("Choose a valid fraction operation.");
        }

        const reduced = reduceFraction(numerator, denominator);
        return {
          results: [{ label: "Simplified result", value: `${reduced.numerator} / ${reduced.denominator}` }],
          formula: "The result is reduced by dividing its numerator and denominator by their greatest common divisor.",
        };
      },
    },
    loan: {
      title: "Loan payment calculator",
      description: "Estimate a fixed monthly payment from the amount, rate, and term.",
      fields: [
        { name: "principal", label: "Loan amount", type: "number", value: "25000", min: "0.01", max: "1000000000000", step: "any" },
        { name: "rate", label: "Annual interest rate (%)", type: "number", value: "6.5", min: "0", max: "1000", step: "any" },
        { name: "years", label: "Loan term (years)", type: "number", value: "5", min: "0.01", max: "100", step: "any" },
      ],
      formula: "Monthly payment = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1); at 0% interest, payment = P ÷ n.",
      calculate(values) {
        const principal = readNumber(values, "principal", "Loan amount", { min: 0.01, max: 1000000000000 });
        const annualRate = readNumber(values, "rate", "Annual interest rate", { min: 0, max: 1000 });
        const years = readNumber(values, "years", "Loan term", { min: 0.01, max: 100 });
        const months = Math.round(years * 12);
        if (months < 1 || months > 1200) {
          throw new Error("Loan term must be between 1 and 1,200 monthly payments.");
        }
        const monthlyRate = annualRate / 1200;
        const payment = monthlyRate === 0
          ? principal / months
          : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
        const totalPaid = payment * months;
        return {
          results: [
            { label: "Estimated monthly payment", value: formatAmount(payment) },
            { label: "Total of payments", value: formatAmount(totalPaid) },
            { label: "Estimated interest", value: formatAmount(totalPaid - principal) },
          ],
          formula: annualRate === 0
            ? "Monthly payment = loan amount ÷ number of monthly payments."
            : "Monthly payment = P × r ÷ (1 − (1 + r)⁻ⁿ), where r is the monthly rate and n is the number of payments.",
          note: "Estimate only. Fees, taxes, insurance, and lender-specific terms are not included.",
        };
      },
    },
    compound: {
      title: "Compound growth calculator",
      description: "Estimate how a starting balance grows with regular compounding.",
      fields: [
        { name: "principal", label: "Starting amount", type: "number", value: "1000", min: "0", max: "1000000000000", step: "any" },
        { name: "rate", label: "Annual growth rate (%)", type: "number", value: "5", min: "0", max: "1000", step: "any" },
        { name: "years", label: "Time period (years)", type: "number", value: "10", min: "0.01", max: "100", step: "any" },
        { name: "frequency", label: "Compounding frequency", type: "select", value: "12", options: [["1", "Annually"], ["2", "Semi-annually"], ["4", "Quarterly"], ["12", "Monthly"], ["365", "Daily"]] },
      ],
      formula: "Future value = Starting amount × (1 + annual rate ÷ compounding periods)^(periods × years).",
      calculate(values) {
        const principal = readNumber(values, "principal", "Starting amount", { min: 0, max: 1000000000000 });
        const annualRate = readNumber(values, "rate", "Annual growth rate", { min: 0, max: 1000 });
        const years = readNumber(values, "years", "Time period", { min: 0.01, max: 100 });
        const frequency = readNumber(values, "frequency", "Compounding frequency");
        if (![1, 2, 4, 12, 365].includes(frequency)) {
          throw new Error("Choose one of the listed compounding frequencies.");
        }
        const balance = principal * Math.pow(1 + annualRate / 100 / frequency, frequency * years);
        if (!Number.isFinite(balance)) {
          throw new Error("These inputs produce a value too large to calculate.");
        }
        return {
          results: [
            { label: "Estimated ending balance", value: formatAmount(balance) },
            { label: "Estimated growth", value: formatAmount(balance - principal) },
          ],
          formula: "Future value = P × (1 + r ÷ n)^(n × t), where P is the starting amount, r is the annual rate, n is compounding periods per year, and t is years.",
          note: "Illustration only. It assumes a constant rate and no additional deposits, fees, or taxes.",
        };
      },
    },
    bmi: {
      title: "BMI calculator",
      description: "Calculate body mass index using metric or imperial measurements.",
      fields: [
        { name: "units", label: "Measurement units", type: "select", value: "metric", options: [["metric", "Metric (kg, cm)"], ["imperial", "Imperial (lb, in)"]] },
        { name: "weight", label: "Weight (kg)", type: "number", value: "70", min: "1", max: "1000", step: "any" },
        { name: "height", label: "Height (cm)", type: "number", value: "170", min: "30", max: "300", step: "any" },
      ],
      formula: "BMI = weight in kilograms ÷ (height in meters)².",
      calculate(values) {
        const units = values.units || "metric";
        if (units !== "metric" && units !== "imperial") {
          throw new Error("Choose metric or imperial measurements.");
        }
        const weight = readNumber(values, "weight", "Weight", units === "metric"
          ? { min: 1, max: 1000 }
          : { min: 2.2, max: 2204.62 }) * (units === "imperial" ? 0.45359237 : 1);
        const heightValue = readNumber(values, "height", "Height", units === "metric"
          ? { min: 30, max: 300 }
          : { min: 11.8, max: 118.11 });
        const height = units === "imperial" ? heightValue * 0.0254 : heightValue / 100;
        const bmi = weight / (height * height);
        let category = "Obesity range";
        if (bmi < 18.5) {
          category = "Below the standard adult range";
        } else if (bmi < 25) {
          category = "Standard adult range";
        } else if (bmi < 30) {
          category = "Above the standard adult range";
        }
        return {
          results: [
            { label: "BMI", value: formatNumber(bmi) },
            { label: "General adult category", value: category },
          ],
          formula: units === "imperial"
            ? "Convert pounds to kilograms and inches to meters, then calculate BMI = kilograms ÷ meters²."
            : "BMI = weight in kilograms ÷ (height in meters × height in meters).",
          note: "BMI is a general screening measure, not a diagnosis. Adult categories may not apply to children, pregnancy, or every individual.",
        };
      },
    },
    conversion: {
      title: "Unit converter",
      description: "Convert common measurements across eight categories.",
      fields: [
        {
          name: "category",
          label: "Measurement",
          type: "select",
          value: "length",
          options: Object.entries(UNIT_GROUPS).map(([key, group]) => [key, group.label]),
        },
        { name: "amount", label: "Value", type: "number", value: "1", step: "any" },
        { name: "from", label: "From", type: "select", value: "m", options: [] },
        { name: "to", label: "To", type: "select", value: "ft", options: [] },
      ],
      formula: "Convert the input to a standard base unit, then convert from the base unit to the selected unit.",
      calculate(values) {
        const amount = readNumber(values, "amount", "Value");
        const category = UNIT_GROUPS[values.category];
        if (!category || !category.units[values.from] || !category.units[values.to]) {
          throw new Error("Choose valid units from the selected measurement category.");
        }
        if (values.category === "temperature" && temperatureToCelsius(amount, values.from) < -273.15 - 1e-12) {
          throw new Error("Temperature cannot be below absolute zero.");
        }
        const converted = convertUnit(amount, values.from, values.to, category);
        if (!Number.isFinite(converted)) {
          throw new Error("This conversion produces a value too large to calculate.");
        }
        return {
          results: [{ label: `${formatNumber(amount)} ${unitSymbol(category.units[values.from])} equals`, value: `${formatNumber(converted)} ${unitSymbol(category.units[values.to])}` }],
          formula: values.category === "temperature"
            ? "Temperature is converted through Celsius using the standard Celsius, Fahrenheit, and Kelvin equations."
            : `Convert through the base unit for ${category.label.toLowerCase()}, then scale to the selected unit.`,
          note: values.category === "data"
            ? "Data storage uses decimal units (1 KB = 1,000 bytes)."
            : undefined,
        };
      },
    },
  };

  function readNumber(values, name, label, bounds) {
    const raw = values[name];
    if (raw === undefined || String(raw).trim() === "") {
      throw new Error(`${label} is required.`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a valid number.`);
    }
    if (bounds && bounds.min !== undefined && value < bounds.min) {
      throw new Error(`${label} must be at least ${bounds.min}.`);
    }
    if (bounds && bounds.max !== undefined && value > bounds.max) {
      throw new Error(`${label} must be no more than ${bounds.max}.`);
    }
    return value;
  }

  function readInteger(values, name, label) {
    const value = readNumber(values, name, label);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a whole number within the safe integer range.`);
    }
    return BigInt(value);
  }

  function gcd(a, b) {
    let left = a < 0n ? -a : a;
    let right = b < 0n ? -b : b;
    while (right !== 0n) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }
    return left;
  }

  function reduceFraction(numerator, denominator) {
    if (denominator < 0n) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = gcd(numerator, denominator);
    return {
      numerator: (numerator / divisor).toString(),
      denominator: (denominator / divisor).toString(),
    };
  }

  function temperatureToCelsius(value, unit) {
    if (unit === "f") return (value - 32) * 5 / 9;
    if (unit === "k") return value - 273.15;
    return value;
  }

  function celsiusToTemperature(value, unit) {
    if (unit === "f") return value * 9 / 5 + 32;
    if (unit === "k") return value + 273.15;
    return value;
  }

  function convertUnit(value, from, to, category) {
    if (category.units[from] === category.units[to]) return value;
    if (category === UNIT_GROUPS.temperature) {
      return celsiusToTemperature(temperatureToCelsius(value, from), to);
    }
    return value * category.units[from].factor / category.units[to].factor;
  }

  function unitSymbol(unit) {
    const match = unit.label.match(/\(([^)]+)\)/);
    return match ? match[1] : unit.label;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 8,
      useGrouping: true,
    }).format(Object.is(value, -0) ? 0 : value);
  }

  function formatAmount(value) {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: true,
    }).format(Object.is(value, -0) ? 0 : value);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createField(field, id) {
    const wrapper = createElement("div", "tool-field");
    const inputId = `${id}-${field.name}`;
    const label = createElement("label", "", field.label);
    label.htmlFor = inputId;
    wrapper.appendChild(label);

    let input;
    if (field.type === "select") {
      input = createElement("select");
      (field.options || []).forEach(([value, text]) => {
        const option = createElement("option", "", text);
        option.value = value;
        input.appendChild(option);
      });
    } else {
      input = createElement("input");
      input.type = field.type;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
      input.required = true;
    }
    input.id = inputId;
    input.name = field.name;
    if (field.value !== undefined) input.value = field.value;
    wrapper.appendChild(input);
    return wrapper;
  }

  function createResult(result) {
    const section = createElement("div", "tool-result");
    section.setAttribute("role", "status");
    section.setAttribute("aria-live", "polite");

    const heading = createElement("h3", "", "Your result");
    section.appendChild(heading);
    const resultList = createElement("dl", "tool-result-list");
    result.results.forEach((item) => {
      resultList.appendChild(createElement("dt", "", item.label));
      resultList.appendChild(createElement("dd", "", item.value));
    });
    section.appendChild(resultList);
    section.appendChild(createElement("h4", "", "Formula"));
    section.appendChild(createElement("p", "formula-copy", result.formula));
    if (result.note) {
      section.appendChild(createElement("p", "tool-note", result.note));
    }
    return section;
  }

  function populateUnitOptions(form, categoryKey, preserveSelection) {
    const category = UNIT_GROUPS[categoryKey];
    if (!category) return;
    ["from", "to"].forEach((name) => {
      const select = form.elements.namedItem(name);
      const oldValue = preserveSelection ? select.value : "";
      select.replaceChildren();
      Object.entries(category.units).forEach(([value, unit]) => {
        const option = createElement("option", "", unit.label);
        option.value = value;
        select.appendChild(option);
      });
      if (oldValue && category.units[oldValue]) {
        select.value = oldValue;
      } else if (name === "to") {
        select.selectedIndex = Math.min(1, select.options.length - 1);
      }
    });
  }

  function updateBMIUnits(form, previousUnits) {
    const units = form.elements.namedItem("units").value;
    const weight = form.elements.namedItem("weight");
    const height = form.elements.namedItem("height");
    const imperial = units === "imperial";
    const weightLabel = form.querySelector('label[for="bmi-weight"]');
    const heightLabel = form.querySelector('label[for="bmi-height"]');

    weightLabel.textContent = `Weight (${imperial ? "lb" : "kg"})`;
    heightLabel.textContent = `Height (${imperial ? "in" : "cm"})`;
    weight.min = imperial ? "2.2" : "1";
    weight.max = imperial ? "2204.62" : "1000";
    height.min = imperial ? "11.8" : "30";
    height.max = imperial ? "118.11" : "300";

    if (previousUnits === units) return;
    const weightValue = Number(weight.value);
    const heightValue = Number(height.value);
    if (weight.value.trim() && Number.isFinite(weightValue)) {
      weight.value = String(Number((imperial
        ? weightValue / 0.45359237
        : weightValue * 0.45359237).toFixed(4)));
    }
    if (height.value.trim() && Number.isFinite(heightValue)) {
      height.value = String(Number((imperial
        ? heightValue / 2.54
        : heightValue * 2.54).toFixed(4)));
    }
  }

  function renderCalculator(id, workbench) {
    const definition = definitions[id];
    if (!definition) return;
    workbench.replaceChildren();
    workbench.hidden = false;
    workbench.dataset.calculator = id;
    const header = createElement("div", "tool-workbench-heading");
    const copy = createElement("div");
    copy.appendChild(createElement("p", "eyebrow", "Calculator"));
    copy.appendChild(createElement("h2", "", definition.title));
    copy.appendChild(createElement("p", "", definition.description));
    header.appendChild(copy);
    const closeButton = createElement("button", "workbench-close", "Close");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${definition.title}`);
    header.appendChild(closeButton);
    workbench.appendChild(header);

    const form = createElement("form", "tool-form");
    form.noValidate = true;
    form.dataset.calculator = id;
    const fields = createElement("div", "tool-fields");
    definition.fields.forEach((field) => fields.appendChild(createField(field, id)));
    form.appendChild(fields);
    if (id === "bmi") {
      form.elements.namedItem("units").dataset.previousValue = "metric";
    }
    const submit = createElement("button", "btn equals tool-submit", "Calculate");
    submit.type = "submit";
    form.appendChild(submit);
    workbench.appendChild(form);

    if (id === "conversion") {
      populateUnitOptions(form, form.elements.namedItem("category").value, false);
    }
  }

  function init() {
    const workbench = document.getElementById("toolWorkbench");
    if (!workbench) return;

    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-open-calculator]");
      if (openButton) {
        renderCalculator(openButton.dataset.openCalculator, workbench);
        workbench.scrollIntoView({ behavior: "smooth", block: "start" });
        const heading = workbench.querySelector("h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        return;
      }

      if (event.target.closest(".workbench-close")) {
        workbench.hidden = true;
        workbench.replaceChildren();
      }
    });

    document.addEventListener("change", (event) => {
      const form = event.target.closest(".tool-form");
      if (form && form.dataset.calculator === "conversion" && event.target.name === "category") {
        populateUnitOptions(form, event.target.value, false);
      }
      if (form && form.dataset.calculator === "bmi" && event.target.name === "units") {
        const previousUnits = event.target.dataset.previousValue;
        updateBMIUnits(form, previousUnits);
        event.target.dataset.previousValue = event.target.value;
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest(".tool-form");
      if (!form) return;
      event.preventDefault();
      const definition = definitions[form.dataset.calculator];
      if (!definition) return;

      const values = Object.fromEntries(new FormData(form).entries());
      workbench.querySelectorAll(".tool-result, .tool-error").forEach((message) => message.remove());
      try {
        workbench.appendChild(createResult(definition.calculate(values)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to calculate with those values.";
        const errorMessage = createElement("p", "tool-error", message);
        errorMessage.setAttribute("role", "alert");
        form.appendChild(errorMessage);
      }
    });
  }

  const api = {
    definitions,
    unitGroups: UNIT_GROUPS,
    calculate(id, values) {
      const definition = definitions[id];
      if (!definition) throw new Error(`Unknown calculator: ${id}`);
      return definition.calculate(values);
    },
    convertUnit,
    formatNumber,
    init,
  };

  if (global) global.EasyCalcTools = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);

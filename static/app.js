(() => {
  "use strict";

  let state = null;
  let saveTimer = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtMoney = (n) => {
    if (!isFinite(n)) n = 0;
    const negative = n < 0;
    const abs = Math.abs(n);
    const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (negative ? "-$" : "$") + str;
  };

  const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 9);

  // ---------------- Formulas ----------------

  function takeHome(e) {
    const hours = Number(e.hours) || 0;
    const rate = Number(e.rate) || 0;
    const otThreshold = Number(e.otThreshold) || 0;
    const otMult = Number(e.otMultiplier) || 1;
    const tax = Number(e.taxRate) || 0;
    const regHours = Math.min(hours, otThreshold);
    const otHours = Math.max(hours - otThreshold, 0);
    const gross = regHours * rate + otHours * rate * otMult;
    return gross * (1 - tax);
  }

  function incomeTotal() {
    return state.earners.reduce((sum, e) => sum + takeHome(e), 0);
  }

  function carFuelCost() {
    const c = state.car;
    const miles = Number(c.milesPerDay) || 0;
    const days = Number(c.daysPerWeek) || 0;
    const weeks = Number(c.weeksPerMonth) || 0;
    const mpg = Number(c.mpg) || 0;
    const price = Number(c.costPerGallon) || 0;
    if (mpg <= 0) return 0;
    return (miles * days * weeks / mpg) * price;
  }

  function carTotalCost() {
    const payment = Number(state.car.payment) || 0;
    return payment + carFuelCost();
  }

  function cardMonthlyPayment(card) {
    const balance = Number(card.balance) || 0;
    const apr = Number(card.apr) || 0;
    const months = Number(card.payoffMonths) || 0;
    if (balance <= 0 || months <= 0) return 0;
    const i = apr / 12;
    if (i === 0) return balance / months;
    const pmt = (balance * i) / (1 - Math.pow(1 + i, -months));
    return pmt;
  }

  function cardTotalInterest(card) {
    const pmt = cardMonthlyPayment(card);
    const months = Number(card.payoffMonths) || 0;
    const balance = Number(card.balance) || 0;
    return pmt * months - balance;
  }

  function creditCardsTotal() {
    return state.creditCards.reduce((sum, c) => sum + cardMonthlyPayment(c), 0);
  }

  function expensesLineTotal() {
    return state.expenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  }

  function expensesTotal() {
    return expensesLineTotal() + carTotalCost() + creditCardsTotal();
  }

  function leftover() {
    return incomeTotal() - expensesTotal();
  }

  // ---------------- Rendering: Income ----------------

  function renderEarners() {
    const list = $("#earnersList");
    list.innerHTML = "";
    state.earners.forEach((e) => {
      const card = document.createElement("div");
      card.className = "earner-card";
      card.innerHTML = `
        <div class="earner-card-head">
          <input class="earner-name-input" type="text" value="${escapeAttr(e.name)}" data-field="name" />
          <span class="earner-takehome">${fmtMoney(takeHome(e))} / mo</span>
        </div>
        <div class="earner-fields">
          <label class="field"><span class="field-label">Hours / mo</span>
            <input class="field-input" type="number" step="0.1" value="${e.hours}" data-field="hours" /></label>
          <label class="field"><span class="field-label">Hourly rate</span>
            <input class="field-input" type="number" step="0.01" value="${e.rate}" data-field="rate" /></label>
          <label class="field"><span class="field-label">OT threshold (hrs)</span>
            <input class="field-input" type="number" step="1" value="${e.otThreshold}" data-field="otThreshold" /></label>
          <label class="field"><span class="field-label">OT multiplier</span>
            <input class="field-input" type="number" step="0.1" value="${e.otMultiplier}" data-field="otMultiplier" /></label>
          <label class="field"><span class="field-label">Tax rate (0&ndash;1)</span>
            <input class="field-input" type="number" step="0.01" value="${e.taxRate}" data-field="taxRate" /></label>
        </div>
        <button class="row-delete" type="button" aria-label="Remove earner" data-remove="1" style="margin-top:0.75rem;">Remove earner &times;</button>
      `;
      $$("input", card).forEach((inp) => {
        inp.addEventListener("input", () => {
          const field = inp.dataset.field;
          e[field] = field === "name" ? inp.value : Number(inp.value);
          renderEarners();
          renderSummary();
          scheduleSave();
        });
      });
      $("[data-remove]", card).addEventListener("click", () => {
        state.earners = state.earners.filter((x) => x.id !== e.id);
        renderEarners();
        renderSummary();
        scheduleSave();
      });
      list.appendChild(card);
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // ---------------- Rendering: Expenses ----------------

  function renderExpenses() {
    const body = $("#expensesBody");
    body.innerHTML = "";
    state.expenses.forEach((x) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" value="${escapeAttr(x.name)}" data-field="name" /></td>
        <td class="num"><input type="number" step="0.01" class="num-input" value="${x.amount}" data-field="amount" /></td>
        <td><button class="row-delete" type="button" aria-label="Remove line item">&times;</button></td>
      `;
      $$("input", tr).forEach((inp) => {
        inp.addEventListener("input", () => {
          const field = inp.dataset.field;
          x[field] = field === "name" ? inp.value : Number(inp.value);
          renderExpenseTotals();
          renderSummary();
          scheduleSave();
        });
      });
      $(".row-delete", tr).addEventListener("click", () => {
        state.expenses = state.expenses.filter((y) => y.id !== x.id);
        renderExpenses();
        renderSummary();
        scheduleSave();
      });
      body.appendChild(tr);
    });
    renderExpenseTotals();
  }

  function renderExpenseTotals() {
    $("#carLineTotal").textContent = fmtMoney(carTotalCost());
    $("#ccLineTotal").textContent = fmtMoney(creditCardsTotal());
    $("#expensesTotalCell").textContent = fmtMoney(expensesTotal());
  }

  // ---------------- Rendering: Car ----------------

  function renderCar() {
    const c = state.car;
    $("#carPayment").value = c.payment;
    $("#carMiles").value = c.milesPerDay;
    $("#carDays").value = c.daysPerWeek;
    $("#carWeeks").value = c.weeksPerMonth;
    $("#carMpg").value = c.mpg;
    $("#carGasPrice").value = c.costPerGallon;
    renderCarTotals();
  }

  function renderCarTotals() {
    $("#carFuelCost").textContent = fmtMoney(carFuelCost());
    $("#carTotalCost").textContent = fmtMoney(carTotalCost());
  }

  function bindCarInputs() {
    const map = {
      carPayment: "payment", carMiles: "milesPerDay", carDays: "daysPerWeek",
      carWeeks: "weeksPerMonth", carMpg: "mpg", carGasPrice: "costPerGallon",
    };
    Object.entries(map).forEach(([id, field]) => {
      $("#" + id).addEventListener("input", (ev) => {
        state.car[field] = Number(ev.target.value);
        renderCarTotals();
        renderExpenseTotals();
        renderSummary();
        scheduleSave();
      });
    });
  }

  // ---------------- Rendering: Credit cards ----------------

  function renderCards() {
    const body = $("#cardsBody");
    body.innerHTML = "";
    state.creditCards.forEach((c) => {
      const pmt = cardMonthlyPayment(c);
      const interest = cardTotalInterest(c);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" value="${escapeAttr(c.name)}" data-field="name" /></td>
        <td class="num"><input type="number" step="0.01" class="num-input" value="${c.balance}" data-field="balance" /></td>
        <td class="num"><input type="number" step="0.0001" class="num-input" value="${c.apr}" data-field="apr" /></td>
        <td class="num"><input type="number" step="1" class="num-input" value="${c.payoffMonths}" data-field="payoffMonths" /></td>
        <td class="num">${fmtMoney(pmt)}</td>
        <td class="num">${fmtMoney(interest)}</td>
        <td><button class="row-delete" type="button" aria-label="Remove card">&times;</button></td>
      `;
      $$("input", tr).forEach((inp) => {
        inp.addEventListener("input", () => {
          const field = inp.dataset.field;
          c[field] = field === "name" ? inp.value : Number(inp.value);
          renderCards();
          renderExpenseTotals();
          renderSummary();
          scheduleSave();
        });
      });
      $(".row-delete", tr).addEventListener("click", () => {
        state.creditCards = state.creditCards.filter((y) => y.id !== c.id);
        renderCards();
        renderExpenseTotals();
        renderSummary();
        scheduleSave();
      });
      body.appendChild(tr);
    });

    const balTotal = state.creditCards.reduce((s, c) => s + (Number(c.balance) || 0), 0);
    $("#cardsBalanceTotal").textContent = fmtMoney(balTotal);
    $("#cardsPaymentTotal").textContent = fmtMoney(creditCardsTotal());
    $("#cardsInterestTotal").textContent = fmtMoney(
      state.creditCards.reduce((s, c) => s + cardTotalInterest(c), 0)
    );
  }

  // ---------------- Rendering: Forecast ----------------

  function renderForecastInputs() {
    $("#fcStart").value = state.forecast.startingSavings;
    const target = state.forecast.targetMonth;
    if (target && /^\d{4}-\d{2}$/.test(target)) {
      const [y, m] = target.split("-");
      $("#fcTargetYear").value = y;
      $("#fcTargetMonth").value = m;
    } else {
      const now = new Date();
      $("#fcTargetYear").value = now.getFullYear();
      $("#fcTargetMonth").value = String(now.getMonth() + 1).padStart(2, "0");
    }
  }

  function updateTargetMonthFromInputs() {
    const y = $("#fcTargetYear").value;
    const m = $("#fcTargetMonth").value;
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) {
      state.forecast.targetMonth = `${y}-${m}`;
    } else {
      state.forecast.targetMonth = "";
    }
  }

  function bindForecastInputs() {
    $("#fcStart").addEventListener("input", (ev) => {
      state.forecast.startingSavings = Number(ev.target.value);
      renderForecastTable();
      scheduleSave();
    });
    $("#fcTargetMonth").addEventListener("change", () => {
      updateTargetMonthFromInputs();
      renderForecastTable();
      scheduleSave();
    });
    $("#fcTargetYear").addEventListener("input", () => {
      updateTargetMonthFromInputs();
      renderForecastTable();
      scheduleSave();
    });
  }

  function renderAdjustments() {
    const body = $("#adjustmentsBody");
    body.innerHTML = "";
    const monthNames = ["01","02","03","04","05","06","07","08","09","10","11","12"];
    const monthLabels = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    state.forecast.adjustments.forEach((a) => {
      const [curYear, curMonth] = (a.month && /^\d{4}-\d{2}$/.test(a.month)) ? a.month.split("-") : ["", ""];
      const tr = document.createElement("tr");
      const monthOptions = monthNames.map((mn, i) =>
        `<option value="${mn}" ${mn === curMonth ? "selected" : ""}>${monthLabels[i]}</option>`
      ).join("");
      tr.innerHTML = `
        <td><select data-field="month">${monthOptions}</select></td>
        <td><input type="number" step="1" class="num-input" style="width:5rem" value="${curYear}" data-field="year" placeholder="2026" /></td>
        <td><input type="text" value="${escapeAttr(a.label || "")}" data-field="label" /></td>
        <td class="num"><input type="number" step="0.01" class="num-input" value="${a.amount}" data-field="amount" /></td>
        <td><button class="row-delete" type="button" aria-label="Remove adjustment">&times;</button></td>
      `;

      const updateMonthField = () => {
        const y = $("[data-field='year']", tr).value;
        const m = $("[data-field='month']", tr).value;
        a.month = /^\d{4}$/.test(y) ? `${y}-${m}` : "";
      };

      $("[data-field='month']", tr).addEventListener("change", () => {
        updateMonthField();
        renderForecastTable();
        scheduleSave();
      });
      $("[data-field='year']", tr).addEventListener("input", () => {
        updateMonthField();
        renderForecastTable();
        scheduleSave();
      });
      $("[data-field='label']", tr).addEventListener("input", (ev) => {
        a.label = ev.target.value;
        scheduleSave();
      });
      $("[data-field='amount']", tr).addEventListener("input", (ev) => {
        a.amount = Number(ev.target.value);
        renderForecastTable();
        scheduleSave();
      });
      $(".row-delete", tr).addEventListener("click", () => {
        state.forecast.adjustments = state.forecast.adjustments.filter((x) => x.id !== a.id);
        renderAdjustments();
        renderForecastTable();
        scheduleSave();
      });
      body.appendChild(tr);
    });
  }

  function monthsBetween(startYM, endYM) {
    const [sy, sm] = startYM.split("-").map(Number);
    const [ey, em] = endYM.split("-").map(Number);
    return (ey - sy) * 12 + (em - sm);
  }

  function addMonths(ym, n) {
    const [y, m] = ym.split("-").map(Number);
    const total = (y * 12 + (m - 1)) + n;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, "0")}`;
  }

  function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  function renderForecastTable() {
    const body = $("#forecastBody");
    body.innerHTML = "";
    const target = state.forecast.targetMonth;
    if (!target) return;

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let numMonths = monthsBetween(currentYM, target);
    if (numMonths < 0) numMonths = 0;

    const monthlyLeftover = leftover();
    let balance = Number(state.forecast.startingSavings) || 0;

    for (let i = 0; i <= numMonths; i++) {
      const ym = addMonths(currentYM, i);
      const adj = state.forecast.adjustments
        .filter((a) => a.month === ym)
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);
      balance += monthlyLeftover + adj;

      const tr = document.createElement("tr");
      const balCls = balance < 0 ? "balance-negative" : "balance-positive";
      tr.innerHTML = `
        <td>${monthLabel(ym)}</td>
        <td class="num">${fmtMoney(monthlyLeftover)}</td>
        <td class="num">${adj ? fmtMoney(adj) : "&mdash;"}</td>
        <td class="num ${balCls}">${fmtMoney(balance)}</td>
      `;
      body.appendChild(tr);
    }
  }

  // ---------------- Summary ----------------

  function renderSummary() {
    const inc = incomeTotal();
    const exp = expensesTotal();
    const left = inc - exp;
    $("#sumIncome").textContent = fmtMoney(inc);
    $("#sumExpenses").textContent = fmtMoney(exp);
    const leftEl = $("#sumLeftover");
    leftEl.textContent = fmtMoney(left);
    leftEl.classList.toggle("is-negative", left < 0);
    renderForecastTable();
  }

  // ---------------- Tabs ----------------

  function bindTabs() {
    $$(".ledger-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".ledger-tab").forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        const target = tab.dataset.tab;
        $$(".ledger-page").forEach((p) => p.classList.remove("is-active"));
        $("#page-" + target).classList.add("is-active");
      });
    });
  }

  // ---------------- Add buttons ----------------

  function bindAddButtons() {
    $("#addEarner").addEventListener("click", () => {
      state.earners.push({
        id: uid("e"), name: "New earner", hours: 160, rate: 20,
        otThreshold: 160, otMultiplier: 1.5, taxRate: 0.2,
      });
      renderEarners();
      renderSummary();
      scheduleSave();
    });

    $("#addExpense").addEventListener("click", () => {
      state.expenses.push({ id: uid("x"), name: "New line item", amount: 0 });
      renderExpenses();
      renderSummary();
      scheduleSave();
    });

    $("#addCard").addEventListener("click", () => {
      state.creditCards.push({
        id: uid("c"), name: "New card", balance: 0, apr: 0.2, payoffMonths: 24,
      });
      renderCards();
      renderExpenseTotals();
      renderSummary();
      scheduleSave();
    });

    $("#addAdjustment").addEventListener("click", () => {
      state.forecast.adjustments.push({ id: uid("a"), month: state.forecast.targetMonth || "", label: "", amount: 0 });
      renderAdjustments();
      renderForecastTable();
      scheduleSave();
    });
  }

  // ---------------- Persistence ----------------

  function scheduleSave() {
    $("#saveStatus").textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }

  async function save() {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("save failed");
      $("#saveStatus").textContent = "Saved";
    } catch (err) {
      $("#saveStatus").textContent = "Save failed";
    }
  }

  async function load() {
    const res = await fetch("/api/state");
    state = await res.json();
    if (!state.forecast) state.forecast = { startingSavings: 0, targetMonth: "", adjustments: [] };
    if (!state.forecast.adjustments) state.forecast.adjustments = [];
  }

  // ---------------- Init ----------------

  async function init() {
    await load();
    bindTabs();
    bindAddButtons();
    bindCarInputs();
    bindForecastInputs();

    renderEarners();
    renderExpenses();
    renderCar();
    renderCards();
    renderForecastInputs();
    renderAdjustments();
    renderSummary();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

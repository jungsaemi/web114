"use strict";

const form = document.getElementById("trip");
const get = id => document.getElementById(id);
const value = id => get(id).value;
const isLocal = () => form.elements.tripType.value === "local";
const daysInPeriod = () => TravelRules.inclusiveDays(value("start"), value("end"));
const result = get("result");
const printButton = get("print-result");
const saveButton = get("save-result");
const saveError = get("save-error");
const error = get("error");
const stays = get("stays");
const standardLabels = ["운임", "일비", "식비", "숙박비"];
let calculated = false;
let excelReport = null;

function fieldError(control, message) {
  if (control.closest("details")) control.closest("details").open = true;
  const failure = new Error(message);
  failure.control = control;
  throw failure;
}

function number(control, label, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (control.validity.badInput) fieldError(control, label + "에 숫자를 입력하세요.");
  if (optional && control.value === "") return null;
  const amount = control.valueAsNumber;
  if (!Number.isSafeInteger(amount) || amount < minimum || amount > maximum) {
    const requirement = maximum < Number.MAX_SAFE_INTEGER
      ? minimum + " 이상 " + maximum + " 이하의 정수"
      : minimum + " 이상의 정수";
    fieldError(control, label + "에 " + requirement + "를 입력하세요.");
  }
  return amount;
}

function show(id, visible) {
  get(id).hidden = !visible;
}

function stayRows() {
  return [...stays.children];
}

function updateFields() {
  const local = isLocal();
  const grade = value("grade");
  const transport = value("transport");
  const days = daysInPeriod();
  const validPeriod = days !== null && days >= 1;
  const multiple = validPeriod && days > 1;
  const vehicle = value("local-vehicle");
  const eligibleLocal = vehicle !== "assigned";
  const near = get("near").checked && eligibleLocal;
  const reduced = transport === "public-car";
  const sea = TravelRules.airOrSea(transport);
  const actual = grade === "actual";
  const fare = TravelRules.fareInfo(transport, grade, get("car-actual").checked);

  show("period", validPeriod);
  get("period").textContent = validPeriod ? days + "일" : "";
  show("local", local);
  show("outside", !local);
  show("single-duration", !multiple && eligibleLocal);
  show("multi-duration", multiple && eligibleLocal);
  show("local-multi-note", multiple && eligibleLocal);
  show("near-field", eligibleLocal);
  show("near-costs", near);
  const short = multiple ? Number(value("short-days")) > 0 : value("duration") === "short";
  const long = multiple ? Number(value("long-days")) > 0 : value("duration") === "long";
  show("near-short-field", short && vehicle !== "public");
  show("near-long-field", long);
  show("car-options", transport === "car");
  show("fare-field", Boolean(fare));
  show("sea-meal-field", sea && !actual);
  show("half-field", !reduced && !actual);
  show("deduct-field", !sea && !actual);
  get("sea-meal").max = validPeriod ? days : 0;
  get("half").max = validPeriod ? days : 0;
  get("deduct").max = validPeriod ? days : 0;
  get("long-stay").max = validPeriod ? days - 1 : 0;

  if (fare) {
    get("fare-label").textContent = fare[0];
    get("fare-note").textContent = fare[1];
  }
  get("stay-hint").textContent = sea
    ? "수로·항공 여행은 부득이하게 육지에서 숙박한 경우에만 추가하세요."
    : "같은 지역과 1박 요금은 한 줄로 입력할 수 있습니다.";
  get("add-stay").disabled = validPeriod && days === 1;
  get("add-stay").title = get("add-stay").disabled ? "당일 출장에는 숙박을 추가할 수 없습니다." : "";
  for (const [index, stay] of stayRows().entries()) {
    stay.querySelector("legend").textContent = "숙박 " + (index + 1);
    stay.querySelector(".region-field").hidden = grade !== "2";
    stay.querySelector(".exception-field").hidden = grade !== "2";
    stay.querySelector('[name="nights"]').max = validPeriod ? days - 1 : "";
    stay.querySelector("button").setAttribute("aria-label", "숙박 " + (index + 1) + " 삭제");
  }
}

function localRows(days) {
  const vehicle = value("local-vehicle");
  if (vehicle === "assigned") return TravelRules.localAllowance({ vehicle });
  const duration = get("duration");
  let shortDays;
  let longDays;
  if (days === 1) {
    if (!duration.value) fieldError(duration, "출장 시간을 선택하세요.");
    shortDays = Number(duration.value === "short");
    longDays = Number(duration.value === "long");
  } else {
    shortDays = number(get("short-days"), "4시간 미만 출장일 수", { maximum: days });
    longDays = number(get("long-days"), "4시간 이상 출장일 수", { maximum: days });
    if (shortDays + longDays !== days) fieldError(get("short-days"), "두 출장일 수를 더하면 출장 기간 " + days + "일이어야 합니다.");
  }
  const near = get("near").checked;
  const shortCost = near && shortDays && vehicle !== "public" ? number(get("near-short"), "4시간 미만 인정 실비 합계") : 0;
  const longCost = near && longDays ? number(get("near-long"), "4시간 이상 인정 실비 합계") : 0;
  return TravelRules.localAllowance({ shortDays, longDays, vehicle, near, shortCost, longCost });
}

function outsideRows(days) {
  const grade = value("grade");
  const transport = value("transport");
  if (!grade) fieldError(get("grade"), "여비 지급 구분을 선택하세요.");
  if (!transport) fieldError(get("transport"), "교통수단을 선택하세요.");
  const actual = grade === "actual";
  const sea = TravelRules.airOrSea(transport);
  const approvedCar = get("car-actual").checked;
  const fareRule = TravelRules.fareInfo(transport, grade, approvedCar);
  const fare = fareRule ? number(get("fare"), fareRule[0], { optional: true }) ?? 0 : 0;
  const halfDays = actual ? 0 : transport === "public-car" ? days : number(get("half"), "일비 절반 적용 일수", { maximum: days });
  const longStay = number(get("long-stay"), "동일 지역 장기체재 일수", { maximum: days - 1 });
  const mileage = number(get("mileage"), "마일리지 추가 일비", { optional: true }) ?? 0;
  const dailyOverride = number(get("daily-override"), "확인된 기본 일비", { optional: true });
  const foodOverride = number(get("meal-override"), "확인된 식비", { optional: true });
  if (actual && (dailyOverride === null || foodOverride === null)) {
    const control = dailyOverride === null ? get("daily-override") : get("meal-override");
    fieldError(control, "대통령·국무총리는 일비·식비를 실비로 지급합니다. 기관이 확인한 금액을 입력하세요.");
  }
  if (halfDays && longStay > 15 && dailyOverride === null) {
    fieldError(get("daily-override"), "일비 절반과 장기체재 감액이 함께 적용됩니다. 기관이 확인한 기본 일비를 입력하세요.");
  }
  let mealDays = days;
  if (!actual && foodOverride === null) {
    mealDays = sea
      ? number(get("sea-meal"), "식비 지급 대상 일수", { maximum: days })
      : days - number(get("deduct"), "식비 미지급 일수", { maximum: days });
  }
  let usedNights = 0;
  const lodging = stayRows().map(stay => {
    const region = stay.querySelector('[name="region"]');
    const nights = stay.querySelector('[name="nights"]');
    const price = stay.querySelector('[name="price"]');
    if (grade === "2" && !region.value) fieldError(region, "숙박비 상한 적용 지역을 선택하세요.");
    if (days === 1) fieldError(nights, "당일 출장에는 숙박비가 없습니다. 숙박 항목을 삭제하세요.");
    const count = number(nights, "숙박 밤 수", { minimum: 1, maximum: days - 1 });
    usedNights += count;
    if (usedNights >= days) fieldError(nights, "숙박 밤 수 합계는 " + (days - 1) + "박 이하여야 합니다.");
    return { region: region.value, nights: count, price: number(price, "1박당 실제 숙박비"),
      extra: stay.querySelector('[name="extra"]').checked };
  });
  const rows = TravelRules.outsideAllowance({
    days, grade, transport, fare, approvedCar, halfDays, longStay, mileage, dailyOverride, foodOverride,
    mealDays, stays: lodging
  });
  const notes = [];
  if (fareRule && value("fare") === "") notes.push("운임 입력이 비어 있어 0원으로 계산했습니다.");
  if (lodging.some(stay => stay.extra) && grade === "2") notes.push("숙박비 초과분은 인정 조건을 선택한 항목에 한해 상한의 30%까지 반영합니다.");
  if (transport === "mixed") notes.push("수로·항공, 공무용 차량 등 조건이 섞인 일정은 감액·추가 지급 조건에서 해당 일수를 확인하세요.");
  return { rows, notes };
}

function render(rows, status, notes = []) {
  const breakdown = get("breakdown");
  const total = get("total");
  excelReport = rows ? {
    start: value("start"), end: value("end"), status, rows, notes,
    total: rows.reduce((sum, item) => sum + item.amount, 0)
  } : null;
  printButton.disabled = saveButton.disabled = !excelReport;
  saveError.hidden = true;
  get("print-period").textContent = excelReport
    ? excelReport.start.replaceAll("-", ".") + " ~ " + excelReport.end.replaceAll("-", ".")
    : "";
  total.textContent = excelReport ? TravelRules.won(excelReport.total).slice(0, -1) : "—";
  get("result-status").textContent = status;
  const display = rows ?? (isLocal() ? ["근무지 내 출장여비"] : standardLabels).map(label => ({ label }));
  breakdown.replaceChildren(...display.map(item => {
    const entry = document.createElement("div");
    const label = document.createElement("dt");
    const amount = document.createElement("dd");
    label.textContent = item.label;
    amount.textContent = item.amount === undefined ? "—" : TravelRules.won(item.amount);
    if (item.detail) {
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      label.append(detail);
    }
    entry.append(label, amount);
    return entry;
  }));
  const noteList = get("result-notes");
  noteList.replaceChildren(...notes.map(note => {
    const li = document.createElement("li");
    li.textContent = note;
    return li;
  }));
  noteList.hidden = !notes.length;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  error.hidden = true;
  form.querySelector('[aria-invalid="true"]')?.removeAttribute("aria-invalid");
  try {
    if (!value("start") || get("start").validity.badInput) fieldError(get("start"), "출장 시작일을 입력하세요.");
    const days = daysInPeriod();
    if (days === null) fieldError(get("end"), "복귀일을 입력하세요.");
    if (days < 1) fieldError(get("end"), "복귀일은 출장 시작일과 같거나 이후여야 합니다.");
    const { rows, notes } = isLocal() ? { rows: localRows(days), notes: [] } : outsideRows(days);
    const total = rows.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isSafeInteger(total)) fieldError(get("start"), "입력 금액이 너무 큽니다. 금액을 확인하세요.");
    if (value("start") < "2026-10-02") notes.unshift("현재 계산은 2026년 10월 2일 시행본 기준입니다. 출장일에 적용되는 규정을 확인하세요.");
    render(rows, days + "일 · " + (isLocal() ? "근무지 내 출장" : "근무지 외 출장"), notes);
    calculated = true;
    result.focus();
  } catch (failure) {
    if (!failure.control) throw failure;
    error.textContent = failure.message;
    error.hidden = false;
    failure.control.setAttribute("aria-invalid", "true");
    failure.control.focus();
  }
});

function refresh() {
  error.hidden = true;
  form.querySelector('[aria-invalid="true"]')?.removeAttribute("aria-invalid");
  updateFields();
  render(null, calculated ? "입력이 변경되었습니다. 다시 계산해 주세요." : "출장 정보를 입력하고 계산해 주세요.");
}

form.addEventListener("input", refresh);
const criteriaDialog = get("criteria-dialog");
get("open-criteria").addEventListener("click", () => {
  criteriaDialog.showModal();
  get("criteria-body").scrollTop = 0;
});
get("close-criteria").addEventListener("click", () => criteriaDialog.close());
printButton.addEventListener("click", () => window.print());
saveButton.addEventListener("click", async () => {
  const report = excelReport;
  if (!report) return;
  saveError.hidden = true;
  try {
    const file = await createTripWorkbook(report);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "출장여비_" + report.start + "_" + report.end + ".xlsx";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) {
    if (excelReport === report) saveError.hidden = false;
    console.error(error);
  }
});
form.addEventListener("change", event => {
  if (event.target.id === "grade" && event.target.value === "actual") {
    get("adjustments").open = true;
  }
});
form.addEventListener("reset", () => {
  stays.replaceChildren();
  get("adjustments").open = false;
  calculated = false;
  queueMicrotask(refresh);
});

get("add-stay").addEventListener("click", () => {
  const nextStay = get("stay-template").content.cloneNode(true);
  stays.append(nextStay);
  refresh();
  stays.lastElementChild.querySelector(value("grade") === "2" ? "select" : 'input[name="nights"]').focus();
});
stays.addEventListener("click", event => {
  if (!event.target.matches(".remove-stay")) return;
  event.target.closest(".stay").remove();
  refresh();
  get("add-stay").focus();
});
refresh();

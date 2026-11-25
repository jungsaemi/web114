"use strict";

const TravelRules = (() => {
  const RATE = 25000;
  const LODGING_CAP = { seoul: 100000, metro: 80000, other: 70000 };
  const regionLabels = { seoul: "서울", metro: "광역시", other: "기타 지역" };
  const DAY = 86400000;
  const numberFormat = new Intl.NumberFormat("ko-KR");
  const won = amount => numberFormat.format(amount) + "원";
  const row = (label, amount, detail) => ({ label, amount, detail });

  function inclusiveDays(start, end) {
    if (!start || !end) return null;
    const from = Date.parse(start + "T00:00:00Z");
    const to = Date.parse(end + "T00:00:00Z");
    return Number.isFinite(from) && Number.isFinite(to) ? (to - from) / DAY + 1 : null;
  }

  function fareInfo(transport, grade, approvedCar) {
    switch (transport) {
      case "rail": return ["왕복 철도·전철 운임", grade === "2" ? "철도 일반실 기준 실비 또는 전철 실비" : grade ? "철도 특실 기준 실비 또는 전철 실비" : "여비 지급 구분에 해당하는 실비"];
      case "bus": return ["왕복 버스 운임", "할인이 가능하면 할인된 요금을 입력하세요."];
      case "car": return approvedCar
        ? ["인정된 자가용 운임", "기관 기준에 따라 인정된 연료비·통행료 등의 합계"]
        : ["왕복 철도·버스 기준 운임", "지급 구분에 해당하는 철도 또는 버스 기준액"];
      case "air": return ["왕복 항공 운임", "공적 마일리지 등 감액 후 인정되는 실비"];
      case "ship": return ["왕복 선박 운임", grade === "2" ? "선박 2등급 기준 실비" : grade ? "선박 1등급 기준 실비" : "여비 지급 구분에 해당하는 실비"];
      case "mixed": return ["지급 대상 운임 합계", "여러 수단은 지급 가능한 구간별 금액을 합산하고, 운임이 없으면 0을 입력하세요."];
      default: return null;
    }
  }

  function airOrSea(transport) {
    return ["air", "ship", "public-other"].includes(transport);
  }

  function localAllowance({ shortDays, longDays, vehicle, near, shortCost, longCost }) {
    if (vehicle === "assigned") {
      return [row("근무지 내 출장여비", 0, "전용 차량 배정자 · 제18조")];
    }
    const shortCap = (vehicle === "public" ? 0 : 10000) * shortDays;
    const longCap = (vehicle === "public" ? 10000 : 20000) * longDays;
    const amount = near ? Math.min(shortCap, shortCost) + Math.min(longCap, longCost) : shortCap + longCap;
    let detail = "4시간 미만 " + shortDays + "일 · 4시간 이상 " + longDays + "일";
    if (vehicle === "public") detail += " · 일별 10,000원 감액";
    if (near) detail += " · 근거리 인정 실비";
    return [row("근무지 내 출장여비", amount, detail)];
  }

  function longStayDeduction(stayDays) {
    const atTen = Math.max(Math.min(stayDays, 30) - 15, 0);
    const atTwenty = Math.max(Math.min(stayDays, 60) - 30, 0);
    const atThirty = Math.max(stayDays - 60, 0);
    return 2500 * atTen + 5000 * atTwenty + 7500 * atThirty;
  }

  function overnightAllowance(stays, grade) {
    return stays.map(({ region, nights, price, extra }) => {
      const cap = LODGING_CAP[region];
      const maximum = cap * (extra ? 1.3 : 1);
      const amount = grade === "2" ? Math.min(price, Math.round(maximum)) : price;
      let detail = nights + "박 × " + won(amount);
      if (grade === "2") detail = regionLabels[region] + " · " + detail + " · 상한 " + won(cap);
      if (grade === "2" && amount > cap) detail += " · 초과분 인정";
      return row("숙박비", amount * nights, detail);
    });
  }

  function outsideAllowance(trip) {
    const { days, transport, grade, fare, approvedCar, halfDays, longStay, mileage,
      dailyOverride, foodOverride, mealDays, stays } = trip;
    const fareRule = fareInfo(transport, grade, approvedCar);
    const dailyDeduction = longStayDeduction(longStay);
    let daily = dailyOverride ?? (RATE * days - halfDays * RATE / 2 - dailyDeduction);
    let dailyDetail = days + "일 × " + won(RATE);
    if (halfDays) dailyDetail += " · " + halfDays + "일 절반";
    if (dailyDeduction) dailyDetail += " · 장기체재 " + won(dailyDeduction) + " 감액";
    if (dailyOverride !== null) dailyDetail = "기관 확인 금액";
    if (mileage) dailyDetail += " · 마일리지 " + won(mileage) + " 추가";
    daily += mileage;

    const food = foodOverride ?? RATE * mealDays;
    const foodDetail = foodOverride === null ? mealDays + "일 × " + won(RATE) : "기관 확인 금액";
    const lodging = overnightAllowance(stays, grade);
    return [
      row("운임", fare, fareRule ? fareRule[0] : "공용 교통수단 이용 · 제15조"),
      row("일비", daily, dailyDetail),
      row("식비", food, foodDetail),
      ...(lodging.length ? lodging : [row("숙박비", 0, "입력된 유상 숙박 없음")]),
    ];
  }

  return { inclusiveDays, fareInfo, airOrSea, localAllowance, longStayDeduction, outsideAllowance, won };
})();

if (typeof module !== "undefined") module.exports = TravelRules;

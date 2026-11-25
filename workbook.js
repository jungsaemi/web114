"use strict";

const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const officeRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const workbookMime = "application/vnd.openxmlformats-officedocument.spreadsheetml";

function escapeCellText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function textCell(ref, value, style = 0) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeCellText(value)}</t></is></c>`;
}

function numberCell(ref, value, style, formula = "") {
  const formulaElement = formula ? `<f>${formula}</f>` : "";
  return `<c r="${ref}" s="${style}">${formulaElement}<v>${value}</v></c>`;
}

function dateCell(ref, date) {
  const day = Date.parse(date + "T00:00:00Z");
  if (date < "1900-01-01" || date > "9999-12-31" || !Number.isFinite(day)) {
    return textCell(ref, date);
  }
  // Excel includes a fictitious 1900-02-29 in its date serials.
  const epoch = date < "1900-03-01" ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  return numberCell(ref, (day - epoch) / 86400000, 5);
}

function worksheetRow(index, height, ...cells) {
  return `<row r="${index}" ht="${height}" customHeight="1">${cells.join("")}</row>`;
}

function tripWorksheet({ start, end, status, rows, notes, total }) {
  const firstDetail = 8;
  const lastDetail = firstDetail + rows.length - 1;
  const content = [
    worksheetRow(1, 30, textCell("A1", "국내 출장여비 계산 결과", 1)),
    worksheetRow(2, 21, textCell("A2", "출장 시작일"), dateCell("B2", start)),
    worksheetRow(3, 21, textCell("A3", "복귀일"), dateCell("B3", end)),
    worksheetRow(4, 21, textCell("A4", "출장 일수 및 구분"), textCell("B4", status)),
    worksheetRow(5, 25, textCell("A5", "예상 지급액 (원)", 2), numberCell("C5", total, 4, `SUM(C${firstDetail}:C${lastDetail})`)),
    worksheetRow(7, 23, textCell("A7", "항목", 2), textCell("B7", "산출 내역", 2), textCell("C7", "금액 (원)", 2)),
  ];
  const merges = ["A1:C1", "A5:B5"];
  for (const [index, item] of rows.entries()) {
    const row = firstDetail + index;
    const detail = item.detail ?? "";
    content.push(worksheetRow(row, detail.length > 40 ? 34 : 23,
      textCell("A" + row, item.label, 6),
      textCell("B" + row, detail, 6),
      numberCell("C" + row, item.amount, 3)));
  }
  for (const [index, note] of notes.entries()) {
    const row = lastDetail + 2 + index;
    content.push(worksheetRow(row, 34,
      textCell("A" + row, index === 0 ? "참고 사항" : ""),
      textCell("B" + row, note, 6)));
    merges.push(`B${row}:C${row}`);
  }
  return `<worksheet xmlns="${spreadsheetNamespace}">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <cols><col min="1" max="1" width="23" customWidth="1"/><col min="2" max="2" width="67" customWidth="1"/><col min="3" max="3" width="20" customWidth="1"/></cols>
  <sheetData>${content.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
}

const tripWorkbookStyles = `<styleSheet xmlns="${spreadsheetNamespace}">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF182B3B"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="11"/><color rgb="FF102E40"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF102E40"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F5F1"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="3" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function createTripWorkbook(report) {
  const archive = new JSZip();
  const parts = {
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="${workbookMime}.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="${workbookMime}.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="${workbookMime}.styles+xml"/>
    </Types>`,
    "_rels/.rels": `<Relationships xmlns="${packageRelationships}">
      <Relationship Id="rId1" Type="${officeRelationships}/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${spreadsheetNamespace}" xmlns:r="${officeRelationships}">
      <bookViews><workbookView/></bookViews>
      <sheets><sheet name="출장여비" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${packageRelationships}">
      <Relationship Id="rId1" Type="${officeRelationships}/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="${officeRelationships}/styles" Target="styles.xml"/>
    </Relationships>`,
    "xl/styles.xml": tripWorkbookStyles,
    "xl/worksheets/sheet1.xml": tripWorksheet(report),
  };
  for (const [path, xml] of Object.entries(parts)) {
    archive.file(path, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml, { createFolders: false });
  }
  return archive.generateAsync({ type: "blob", mimeType: workbookMime + ".sheet" });
}

import ExcelJS from "exceljs";

export interface ExportColumn<T> {
  key: keyof T & string;
  label: string;
  format?: (value: T[keyof T]) => string | number;
}

export async function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = "Sheet1",
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = columns.map(col => ({
    header: col.label,
    key: col.key,
    width: Math.max(col.label.length + 2, 15),
  }));

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

  for (const row of rows) {
    const rowData: Record<string, unknown> = {};
    for (const col of columns) {
      const value = row[col.key];
      rowData[col.key] = col.format ? col.format(value) : (value ?? "");
    }
    ws.addRow(rowData);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

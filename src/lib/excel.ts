import ExcelJS from "exceljs";

export async function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  sheetName = "Sheet1"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    const buffer = await workbook.xlsx.writeBuffer();
    triggerDownload(buffer as ArrayBuffer, filename);
    return;
  }

  const firstRow = rows[0]!;
  const columnKeys = Object.keys(firstRow);
  worksheet.columns = columnKeys.map((key) => ({
    header: key,
    key,
    width: Math.max(key.length + 2, 15),
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, filename);
}

function triggerDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
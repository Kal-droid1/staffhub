const ExcelJS = require("exceljs");

const wb = new ExcelJS.Workbook();
wb.xlsx.readFile("staffhub-report-template-updated.xlsx").then(() => {
  const sheet = wb.getWorksheet("Attendance Grid");

  console.log("=== Legend area (rows 17-22) ===");
  for (let r = 17; r <= 22; r++) {
    const row = sheet.getRow(r);
    console.log(`Row ${r}:`);
    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      console.log(`  Col ${c}: value=${JSON.stringify(cell.value)}, hasBorder=${!!cell.style?.border}`);
    }
  }

  console.log("\n=== Template data (rows 6-15) ===");
  for (let r = 6; r <= 15; r++) {
    const row = sheet.getRow(r);
    console.log(`Row ${r} col C: value=${JSON.stringify(row.getCell(3).value)}`);
  }

  console.log("\nDone.");
}).catch(e => console.error(e));

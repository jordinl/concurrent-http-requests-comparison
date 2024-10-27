import {readFileSync} from "node:fs";

const settings = JSON.parse(readFileSync("settings.json", "utf8"));

let results = [];

// could use console.table, but I don't want to show index column or quotes
// also align numbers right
const printTable = data => {
  if (data.length === 0) {
    return;
  }
  const headers = Object.keys(data[0]);
  const columnLengths = headers.reduce((agg, header) => {
    const length = Math.max(header.length, ...data.map(row => (row[header]?.toString() || "").length));
    return {...agg, [header]: length};
  }, {});

  const topBorder = "┌" + Object.values(columnLengths).map(length => "─".repeat(length + 2)).join("┬") + "┐";
  const headerRow = "│ " + headers.map(header => header.padEnd(columnLengths[header])).join(" │ ") + " │";
  const divider = "├" + Object.values(columnLengths).map(length => "─".repeat(length + 2)).join("┼") + "┤";
  const rows = data.map(row => {
    const innerRow = headers.map(header => {
      const value = row[header];
      const maxLength = columnLengths[header];
      return typeof value === "string" ? value.padEnd(maxLength) : (value?.toString() || "").padStart(maxLength);
    }).join(" │ ");
    return "│ " + innerRow + " │";
  });
  const bottomBorder = "└" + Object.values(columnLengths).map(length => "─".repeat(length + 2)).join("┴") + "┘";
  const table = [topBorder, headerRow, divider, ...rows, bottomBorder].join("\n");
  console.log(table);
};

for (const entry of settings) {
  const {name, concurrency, language, method} = entry;
  console.log(`Running ${name} with concurrency ${concurrency}`);

  const command = new Deno.Command("./bin/run", {
    args: [name],
    env: {FORMAT: "result", CONCURRENCY: concurrency.toString()}
  });
  const {code, stdout, stderr} = await command.outputSync();
  if (code === 0) {
    const output = new TextDecoder().decode(stdout);
    console.log(output);
    const aggregates = JSON.parse(output);
    results.push({language, method, concurrency, ...aggregates});
  } else {
    console.log(new TextDecoder().decode(stderr));
  }
}

results.sort((a, b) => a.time - b.time);
printTable(results);

import {createInterface} from "node:readline";

const FORMAT = Deno.env.get("FORMAT");

let results = [];

for await (const line of createInterface({input: process.stdin})) {
  const [url, code, startTimeStr, durationStr, bodyLengthStr] = line.split(",");
  const startTime = Date.parse(startTimeStr);
  const duration = parseInt(durationStr);
  const bodyLength = parseInt(bodyLengthStr);
  if (FORMAT !== "result") {
    const color = code[0] === "2" ? "green" : (code.match(/^[0-9]{3}$/) ? "yellow" : "red");
    console.log(`%c[${code}] ${url}: ${duration}ms`, `color: ${color}`);
  }

  results.push({code, startTime, duration, bodyLength});
}

const defaultCounts = ["2xx", "3xx", "4xx", "5xx", "Exception"].reduce((agg, key) => {
  return {...agg, [key]: 0};
}, {});

const counts = results.reduce((agg, {code}) => {
  const shortCode = code.match(/^[0-9]{3}$/) ? `${code[0]}xx` : "Exception";
  return {...agg, [shortCode]: agg[shortCode] + 1};
}, defaultCounts);
const avg = results.reduce((agg, r) => agg + r.duration, 0) / results.length;
const max = Math.max(...results.map(r => r.duration));
const startTime = Math.min(...results.map(r => r.startTime));
const endTime = Math.max(...results.map(r => r.startTime + r.duration));
const totalTime = endTime - startTime;
const sumBodyLength = results.reduce((agg, r) => agg + (r.code[0] === "2" ? r.bodyLength : 0), 0);
const totalUrls = Object.values(counts).reduce((agg, count) => agg + count, 0);

const aggregates = {
  totalUrls,
  time: totalTime,
  avg: Math.round(avg),
  max,
  okReqsSec: Math.round(counts["2xx"] / totalTime * 1000),
  okReqsPct: Math.round(100 * counts["2xx"] / totalUrls) / 100,
  avgBodyLength: Math.round(sumBodyLength / counts["2xx"]),
  ...counts
};

console.log(JSON.stringify(aggregates, null, 2));

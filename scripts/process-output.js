import {createInterface} from "node:readline";

const colors = {
  "red": "\x1b[31m",
  "green": "\x1b[32m",
  "yellow": "\x1b[33m",
  "white": "\x1b[37m",
  "reset": "\x1b[0m",
}

const print = (message, color = "white") => {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let results = []

for await (const line of createInterface({input: process.stdin})) {
  const [url, code, startTimeStr, durationStr, length] = line.split(",");
  const startTime = Date.parse(startTimeStr);
  const duration = parseInt(durationStr);
  const color = code[0] === "2" ? "green" : (code.match(/^[0-9]{3}$/) ? "yellow" : "red");
  print(`[${code}] ${url}: ${duration}ms`, color);

  results.push({code, startTime, duration});
}

const defaultCounts = ['2xx', '3xx', '4xx', '5xx', 'Exception'].reduce((agg, key) => {
  return {...agg, [key]: 0}
}, {});

const counts = results.reduce((agg, {code}) => {
  const shortCode = code.match(/^[0-9]{3}$/) ? `${code[0]}xx` : 'Exception';
  return {...agg, [shortCode]: agg[shortCode] + 1};
}, defaultCounts);
const avgDuration = results.reduce((agg, r) => agg + r.duration, 0) / results.length;
const maxDuration = Math.max(...results.map(r => r.duration));
const startTime = Math.min(...results.map(r => r.startTime));
const endTime = Math.max(...results.map(r => r.startTime + r.duration));
const totalTime = endTime - startTime;

const aggregates = {
  totalTime,
  avgDuration: Math.round(avgDuration),
  maxDuration,
  totalUrls: Object.values(counts).reduce((agg, count) => agg + count, 0),
  okReqsSecond: Math.round(counts['2xx'] / totalTime * 1000),
  ...counts
}

console.log(aggregates);

import { readFileSync } from 'node:fs';

const settings = JSON.parse(readFileSync('settings.json', 'utf8'));

let results = []

for (const entry of settings) {
  const { name, concurrency} = entry;
  console.log(`Running ${name} with concurrency ${concurrency}`);

  const command = new Deno.Command('./bin/run', { args: [name], env: { FORMAT: "result", CONCURRENCY: concurrency.toString() } });
  const { code, stdout, stderr } = await command.outputSync();
  if (code === 0) {
    const output = JSON.parse(new TextDecoder().decode(stdout));
    console.log(output);
    results.push({ name, concurrency, ...output });
  } else {
    console.log(new TextDecoder().decode(stderr));
  }
}

results.sort((a, b) => a.time - b.time);
console.table(results);

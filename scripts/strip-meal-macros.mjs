#!/usr/bin/env node
import fs from "fs";
import path from "path";

const file = path.join(path.resolve(import.meta.dirname, ".."), "apps/android/app/src/main/assets/weekday_fuel/meals.js");
let s = fs.readFileSync(file, "utf8");
s = s.replace(/\s+k:\s*[\d.]+,/g, "");
s = s.replace(/\s+p:\s*[\d.]+,/g, "");
s = s.replace(/\s+c:\s*[\d.]+,/g, "");
s = s.replace(/\s+f:\s*[\d.]+,/g, "");
s = s.replace(/\s+fib:\s*[\d.]+,/g, "");
s = s.replace(/\/\* k=kcal[^*]*\*\//, "/* cost=AUD per serve. Macros computed at runtime from AMOUNTS × panels. */");
fs.writeFileSync(file, s, "utf8");
console.log("Stripped typed macros from meals.js");

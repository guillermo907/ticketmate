const required = ["DATABASE_URL"];
const optional = ["DIRECT_URL"];

let failed = false;

for (const key of required) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    console.error(`Missing required env: ${key}`);
    failed = true;
  }
}

for (const key of optional) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    console.warn(`Optional env not set: ${key}`);
  }
}

if (process.env.DATABASE_URL && !String(process.env.DATABASE_URL).includes("neon")) {
  console.warn("DATABASE_URL is set, but it does not look like a Neon connection string.");
}

if (process.env.DIRECT_URL && !String(process.env.DIRECT_URL).includes("neon")) {
  console.warn("DIRECT_URL is set, but it does not look like a Neon connection string.");
}

if (failed) {
  process.exit(1);
}

console.log("Neon environment looks ready.");

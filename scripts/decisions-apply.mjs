#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const { op, path: jsonPtr, value } = args;

const file = path.join(process.cwd(), "decisions.json");
if (!fs.existsSync(file)) {
  console.error("decisions.json not found");
  process.exit(1);
}
const doc = JSON.parse(fs.readFileSync(file, "utf8"));

const getByPtr = (obj, ptr, create = false) => {
  if (!ptr.startsWith("/")) throw new Error("JSON Pointer must start with /");
  const parts = ptr
    .slice(1)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) {
      if (create) cur[k] = {};
      else throw new Error(`Path not found: ${parts.slice(0, i + 1).join("/")}`);
    }
    cur = cur[k];
    if (typeof cur !== "object") throw new Error(`Non-object at ${parts.slice(0, i + 1).join("/")}`);
  }
  const last = parts[parts.length - 1];
  return { parent: cur, key: last };
};

const stable = (x) => {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])]));
  }
  return x;
};

const writeFile = (obj) => {
  fs.writeFileSync(file, JSON.stringify(stable(obj), null, 2) + "\n", "utf8");
};

try {
  if (op === "set") {
    const v = (() => {
      if (value === undefined) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    })();
    const { parent, key } = getByPtr(doc, jsonPtr, true);
    parent[key] = v;
    if (doc.meta && typeof doc.meta === "object") doc.meta.updatedAt = new Date().toISOString();
    writeFile(doc);
  } else if (op === "remove") {
    const { parent, key } = getByPtr(doc, jsonPtr, false);
    delete parent[key];
    if (doc.meta && typeof doc.meta === "object") doc.meta.updatedAt = new Date().toISOString();
    writeFile(doc);
  } else if (op === "add-history") {
    const entry = (() => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })();
    if (!entry || !entry.date || !entry.decision) throw new Error("value must be JSON with at least {date, decision}");
    doc.history = Array.isArray(doc.history) ? doc.history : [];
    doc.history.push(entry);
    if (doc.meta && typeof doc.meta === "object") doc.meta.updatedAt = new Date().toISOString();
    writeFile(doc);
  } else {
    throw new Error(`Unsupported op: ${op}`);
  }
  console.log("OK");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

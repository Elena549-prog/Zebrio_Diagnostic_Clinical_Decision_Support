// Usage: npm run code -- [path/to/request.json]   (defaults to examples/request.json)
import { existsSync, readFileSync } from "node:fs";
import { assignMedicalCodes } from "./assignMedicalCodes.ts";
import type { CodingRequest } from "./types.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

const path = process.argv[2] ?? "examples/request.json";
const request = JSON.parse(readFileSync(path, "utf8")) as CodingRequest;
const response = await assignMedicalCodes(request);
console.log(JSON.stringify(response, null, 2));

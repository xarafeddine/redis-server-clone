import { ServerConfig, StreamEntries } from "./types";

export function parseRESP(buffer: Buffer): string[] {
  const data = buffer.toString();
  const lines = data.split("\r\n");
  const command: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("*")) {
      // Array length line, skip it
      i++;
      continue;
    }
    if (line.startsWith("$")) {
      // Bulk string length line, skip it
      i++;
      const valueLine = lines[i];
      command.push(valueLine);
      i++;
    } else {
      // Simple strings or errors
      command.push(line);
      i++;
    }
  }

  return command.filter((str) => str);
}

export const simpleString = (reply: string) => `+${reply}\r\n`;
export const bulkString = (reply?: string) =>
  reply ? `$${reply.length}\r\n${reply}\r\n` : "$-1\r\n";

export function arrToRESP(arr: string[]) {
  const len = arr.length;
  if (len == 0) return "*0\r\n";
  return arr.reduce((acc: string, cur: string) => {
    acc += bulkString(cur);
    return acc;
  }, `*${len}\r\n`);
}

export function parseArguments() {
  const args = process.argv.slice(2); // Skip the first two arguments
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace("--", "");
    const value = args[i + 1];
    params[key] = value;
  }

  return params;
}

export const rdbConfig: ServerConfig = {
  dir: parseArguments()["dir"] || "",
  dbfilename: parseArguments()["dbfilename"] || "",
};
// export const RDBFilePath = path.join(rdbConfig.dir, rdbConfig.dbfilename);

export function stringToBytes(s: string): Uint8Array {
  return new Uint8Array(s.split("").map((s: string) => s.charCodeAt(0)));
}
export function bytesToString(arr: Uint8Array): string {
  return Array.from(arr)
    .map((n) => String.fromCharCode(n))
    .join("");
}

export function createExpirationDate(milliseconds: number): Date {
  const currentDate = new Date();
  if (!milliseconds) return currentDate;
  const expirationTime = currentDate.getTime() + milliseconds;
  const expirationDate = new Date(expirationTime);
  return expirationDate;
}

export function isExpired(expirationDate?: Date): boolean {
  if (!expirationDate) return false;
  const currentDate = new Date();
  return currentDate > expirationDate;
}

export function getType(value: string): string {
  try {
    // Try to parse the value as JSON
    const parsedValue = JSON.parse(value);

    // Determine the type based on the parsed value
    if (typeof parsedValue === "string") {
      return "string";
    } else if (Array.isArray(parsedValue)) {
      return "list";
    } else if (parsedValue !== null && typeof parsedValue === "object") {
      if (Object.keys(parsedValue).some((key) => regxStreamId.test(key)))
        return "stream";
      // Check if it is a set (all unique values)
      const isSet =
        new Set(Object.values(parsedValue)).size ===
        Object.keys(parsedValue).length;
      if (isSet) {
        return "set";
      }
      // For simplicity, we'll just assume all other objects are hashes
      return "hash";
    } else if (typeof parsedValue === "number") {
      // Redis doesn't have a specific type for numbers, but in this context, you could return string
      return "string";
    }
  } catch (e) {
    // If parsing fails, assume it's a plain string
    return "string";
  }

  // If none of the above conditions are met, return 'unknown'
  return "unknown";
}

export const regxStreamId = new RegExp(/^\d+-\d+$/);

export function parseStreamEntries(parts: string[]): StreamEntries {
  // Initialize an empty object to hold the entries
  const entries: StreamEntries = {};

  // Initialize an index to start processing entries from
  let i = 0;
  while (i < parts.length) {
    // Extract the entry ID
    const entryID = parts[i];

    // Initialize an empty object to hold the key-value pairs for the current entry
    const entryData: Record<string, string> = {};

    // Move to the first key-value pair for this entry
    i++;

    // Loop through the key-value pairs for this entry
    while (i < parts.length && !regxStreamId.test(parts[i])) {
      const key = parts[i];
      const value = parts[i + 1];
      entryData[key] = value;
      i += 2;
    }

    // Add the entry data to the entries object
    entries[entryID] = entryData;
  }

  return entries;
}

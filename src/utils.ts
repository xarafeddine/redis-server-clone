import path from "path";
import { serverConfig } from "./types";

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

export const rdbConfig: serverConfig = {
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

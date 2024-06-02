import net from "net";
import { ServerConfig, StreamEntry } from "./types";
import { replicaConnections } from "./main";

export function parseRESP(data: string): string[] {
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
export const simpleError = (reply: string) => `-ERR ${reply}\r\n`;
export const bulkString = (reply?: string) =>
  reply ? `$${reply.length}\r\n${reply}\r\n` : "$-1\r\n";
export const RESPInt = (reply: number) => `:${reply}\r\n`;

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
export const serverParams = parseArguments();
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
      if (parsedValue.some(([entryId]) => regxStreamId.test(entryId)))
        return "stream";
      return "list";
    } else if (parsedValue !== null && typeof parsedValue === "object") {
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

export const regxStreamId = new RegExp(/^(?:\d+)-(?:\d+|\*)$|^\*$/);

export function parseStreamEntries(parts: string[]): StreamEntry | null {
  // Extract the entry ID
  const [entryId, ...rest] = parts;
  if (entryId === "0-0") return null;
  if (!regxStreamId.test(entryId)) return null;
  return [entryId, rest];
}

export function generateEntryId(
  newEntryId: string,
  oldEntryId?: string
): string | null {
  if (newEntryId === "*") newEntryId = `${Date.now()}-*`;
  const [new_millisecondsTime, new_sequenceNumber] = newEntryId?.split("-");
  if (!oldEntryId) {
    if (new_sequenceNumber != "*") {
      return newEntryId;
    }
    return [new_millisecondsTime, new_millisecondsTime == "0" ? 1 : 0].join(
      "-"
    );
  }

  const [old_millisecondsTime, old_sequenceNumber] = oldEntryId?.split("-");

  if (old_millisecondsTime === new_millisecondsTime) {
    if (new_sequenceNumber == "*")
      return [new_millisecondsTime, +old_sequenceNumber + 1].join("-");
    return old_sequenceNumber < new_sequenceNumber ? newEntryId : null;
  }

  if (old_millisecondsTime > new_millisecondsTime) return null;
  if (new_sequenceNumber == "*") return [new_millisecondsTime, 0].join("-");
  return newEntryId;
}

export function getEntryRange(
  entries: StreamEntry[],
  startNum: number,
  endNum?: number
) {
  let result: StreamEntry[] = [];
  if (endNum === undefined) {
    endNum = Infinity;
    let [int, dec] = String(startNum).split(".");
    startNum = +int + +`0.${1 + Number(dec) || 0}`;
  }

  console.log(`fetching entries from ${startNum} to ${endNum}`);
  for (let [entryId, entryData] of entries) {
    const entryIdNum = +entryId.replace("-", ".");

    if (entryIdNum >= startNum && entryIdNum <= endNum)
      result.push([entryId, entryData]);
  }
  return result;
}

export function toRESPEntryArray(data: StreamEntry[]): string {
  let respArray: string[] = [];
  respArray.push(`*${data.length}\r\n`);
  for (const entry of data) {
    const [id, keyValues] = entry;
    respArray.push(`*2\r\n`);
    respArray.push(`$${id.length}\r\n${id}\r\n`);
    respArray.push(`*${keyValues.length}\r\n`);

    for (let i = 0; i < keyValues.length; i += 2) {
      const key = keyValues[i];
      const value = keyValues[i + 1];
      respArray.push(`$${key.length}\r\n${key}\r\n`);
      respArray.push(`$${value.length}\r\n${value}\r\n`);
    }
  }

  return respArray.join("");
}

export function toRESPStreamArray(streamArr: [string, StreamEntry[]][]) {
  return `*${streamArr.length}\r\n${streamArr
    .map(([streamKey, streamData]) => {
      return `*2\r\n$${streamKey.length}\r\n${streamKey}\r\n${toRESPEntryArray(
        streamData
      )}`;
    })
    .join("")}`;
}

export function initMaster() {
  const master = serverParams["replicaof"] || "";
  const [url, port] = master.split(/\s|_|:/);
  if (url && Number(port)) {
    serverParams.masterUrl = url;
    serverParams.masterPort = port;
    return false;
  }
  serverParams.master_replid = "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb";
  serverParams.master_repl_offset = "0";
  return true;
}

export const EMPTY_RDB = Buffer.from(
  "524544495330303131fa0972656469732d76657205372e322e30fa0a72656469732d62697473c040fa056374696d65c26d08bc65fa08757365642d6d656dc2b0c41000fa08616f662d62617365c000fff06e3bfec0ff5aa2",
  "hex"
);

// function handleWait(

//   count: number,
//   timeout: number
// ): Promise<number> {
//   let ackCount = 0;

//   return new Promise((resolve) => {
//     const timer = setTimeout(() => {
//       console.log("timeout! count: ", ackCount);
//       resolve(ackCount);
//     }, timeout);
//     const acknowledge = (increment: number) => {
//       ackCount += increment;
//       console.log("acknowledged: ", ackCount);
//       if (ackCount >= count) {
//         console.log("wait complete!");
//         clearTimeout(timer);
//         resolve(ackCount);
//       }
//     };
//     for (const replica of replicaConnections) {
//       if (replica.offset > 0) {
//         (async function (replica) {
//           try {
//             console.log("probing replica with offset: ", replica.offset);
//             const bytesSent = await replica.connection.write(
//               encodeArray(["REPLCONF", "GETACK", "*"])
//             );
//             replica.offset += bytesSent;
//             const tmpBuffer = new Uint8Array(128);
//             await replica.connection.read(tmpBuffer); // Ignoring response for now
//             acknowledge(1);
//           } catch {
//             replica.active = false;
//             acknowledge(0);
//           }
//         })(replica);
//       } else {
//         cfg.ackCount++;
//       }
//     }
//     acknowledge(0);
//   });
// }

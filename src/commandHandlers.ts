import net from "net";
import { StoreValue, StreamEntry } from "./types";
import {
  EMPTY_RDB,
  RESPInt,
  arrToRESP,
  bulkString,
  createExpirationDate,
  generateEntryId,
  getEntryRange,
  getType,
  isExpired,
  parseArguments,
  parseRESP,
  parseStreamEntries,
  serverParams,
  simpleError,
  simpleString,
  toRESPEntryArray,
  toRESPStreamArray,
} from "./utils";
import { replicaConnections, store } from "./main";

export async function handleCommand(
  command: string[],
  connection: net.Socket
): Promise<string> {
  const [cmd, ...args] = command.join(" ").split(" ");

  switch (cmd.toUpperCase()) {
    case "ECHO":
      return handleEcho(args);
    case "PING":
      return handlePing(args);
    case "SET":
      return handleSet(args);
    case "GET":
      return handleGet(args);
    case "DEL":
      return handleDel(args);
    case "CONFIG":
      return handleConfig(args);
    case "KEYS":
      return await handleRDB(args);
    case "TYPE":
      return handleTypes(args);
    case "XADD":
      return handleXadd(args);
    case "XRANGE":
      return handleXrange(args);
    case "XREAD":
      return await handleXread(args);
    case "INFO":
      return handleInfo(args);
    case "REPLCONF":
      return handleReplconf();
    case "WAIT":
      return await handleWait(args);

    case "PSYNC":
      connection.write(
        simpleString(
          `FULLRESYNC ${serverParams.master_replid} ${serverParams.master_repl_offset}`
        )
      );
      connection.write(
        Buffer.concat([
          Buffer.from(`$${EMPTY_RDB.length}\r\n`, "utf-8"),
          EMPTY_RDB,
        ])
      );

      // connection.write(arrToRESP(["REPLCONF", "GETACK", "*"]));

      replicaConnections.push(connection);
      return "";

    default:
      return "-ERR unknown command\r\n";
  }
}

export async function handleMasterCommand(
  receivedData: string,
  connection: net.Socket,
  offset: {
    value: number;
    isActive: boolean;
  }
) {
  const command = parseRESP(receivedData);

  console.log("zalat: ", command);
  let i = 0;
  while (i < command.length) {
    console.log(command[i]);
    if (command[i].toUpperCase() === "SET") {
      handleSet(command.slice(i + 1, i + 3));
      i += 3;
    } else if (command[i].toUpperCase() === "DEL") {
      handleDel(command.slice(i + 1, i + 3));
      i += 3;
    } else if (command[i].toUpperCase() === "GETACK") {
      if (!offset.isActive) offset.value = 0;
      connection.write(arrToRESP(["REPLCONF", "ACK", `${offset.value}`]));
      offset.isActive = true;
      i += 2;
    } else i++;
  }

  // switch (command) {
  //   case "SET":
  //     return handleSet(args);
  //   case "DEL":
  //     return handleDel(args);
  //   default:
  //     return "-ERR unknown command\r\n";
  // }
}

async function handleWait(args: string[]): Promise<string> {
  if (args.length < 2)
    return simpleError("wrong number of arguments for 'wait' command");
  const [numReplica, timeout] = args;
  return await new Promise((res, rej) => {
    setTimeout(() => {
      res(RESPInt(replicaConnections.length));
    }, Number(timeout));
    while (replicaConnections.length < Number(numReplica)) {
      console.log(replicaConnections.length);
    }
    res(RESPInt(replicaConnections.length));
  });
}

function handleReplconf() {
  return simpleString("OK");
}

function handleInfo(args: string[]) {
  if (args[0] === "replication") {
    let role = "master";
    const { master_replid, master_repl_offset } = serverParams;
    if (!master_replid) role = "slave";
    return bulkString(
      `role:${role}\r\nmaster_replid:${master_replid}\r\nmaster_repl_offset:${master_repl_offset}`
    );
  }
  return simpleString("");
}

async function handleXread(args: string[]) {
  if (args[0].toLowerCase() === "block") return await handleXreadBlock(args);
  else return handleXreadNoBlock(args);
}
async function handleXreadBlock(args: string[]) {
  const [_, time, _streams, ...keyValues] = args;
  const timeout = Number(time) === 0 ? 1000 : Number(time);

  if (keyValues.length % 2 != 0) return bulkString();
  while (true) {
    await Bun.sleep(timeout);

    const result = xreadHelper(keyValues);
    const [[_streamkey, data]] = result;
    if (Number(time) !== 0) {
      if (data.length === 0) return bulkString();
      return toRESPStreamArray(result);
    } else {
      if (data.length !== 0) return toRESPStreamArray(result);
    }
  }
}

function handleXreadNoBlock(args: string[]) {
  const [_, ...keyValues] = args;
  if (keyValues.length % 2 != 0)
    return simpleError("wrong number of arguments for 'xread' command");

  return toRESPStreamArray(xreadHelper(keyValues));
}

function xreadHelper(keyValues: string[]) {
  const halfLen = keyValues.length / 2;
  let result: [string, StreamEntry[]][] = [];

  for (let i = 0; i < halfLen; i++) {
    const streamKey = keyValues[i];
    let start = keyValues[i + halfLen];

    const storedStream = store.get(streamKey)?.value;
    if (!storedStream) continue; // return simpleError("Stream doesn't exist");
    const streamEntries = JSON.parse(storedStream) as StreamEntry[];

    if (start === "$") {
      const [lastEntryId] = streamEntries.at(-1) || ["0-0"];
      keyValues[i + halfLen] = lastEntryId;
      start = lastEntryId;
    }
    const startNum = +start.replace("-", ".") || 0;

    result.push([streamKey, getEntryRange(streamEntries, startNum)]);
  }
  return result;
}

function handleXrange(args: string[]) {
  if (args.length < 3)
    return simpleError("wrong number of arguments for 'xrange' command");
  const [streamKey, ...rest] = args;
  const storedStream = store.get(streamKey)?.value;
  if (!storedStream) return simpleError("Stream doesn't exist");

  const [start, end] = rest;
  const startNum = +start.replace("-", ".") || 0;
  const endNum = +end.replace("-", ".") || Infinity;

  if (startNum > endNum)
    return simpleError("The end ID must be greater than the start ID");

  const streamEntries = JSON.parse(storedStream) as StreamEntry[];
  const result = getEntryRange(streamEntries, startNum, endNum);
  return toRESPEntryArray(result);
}

function handleXadd(args: string[]) {
  if (args.length < 4)
    return simpleError("wrong number of arguments for 'xadd' command");
  const [streamKey, ...rest] = args;

  const newStreamEntry = parseStreamEntries(rest);
  if (!newStreamEntry)
    return simpleError("The ID specified in XADD must be greater than 0-0");
  const oldStream = store.get(streamKey);

  if (oldStream) {
    const oldStreamEntries = JSON.parse(oldStream.value) as StreamEntry[];

    const lastStreamEntry = oldStreamEntries?.at(-1)!;
    const newEntryId = generateEntryId(newStreamEntry[0], lastStreamEntry[0]);
    if (newEntryId === null)
      return simpleError(
        "The ID specified in XADD is equal or smaller than the target stream top item"
      );
    newStreamEntry[0] = newEntryId;
    const newStreamValue = [...oldStreamEntries, newStreamEntry];
    store.set(streamKey, {
      value: JSON.stringify(newStreamValue),
      expiration: oldStream.expiration,
    });
    return bulkString(newEntryId);
  }
  const newEntryId = generateEntryId(newStreamEntry[0])!;
  newStreamEntry[0] = newEntryId;
  store.set(streamKey, { value: JSON.stringify([newStreamEntry]) });
  return bulkString(newEntryId);
}

function handleTypes(args: string[]) {
  if (args.length < 1)
    return "-ERR wrong number of arguments for 'type' command\r\n";
  const storeValue = store.get(args[0]);
  if (!storeValue) return simpleString("none");
  return simpleString(getType(storeValue?.value));
}

function handlePing(args: string[]): string {
  return args.length > 0 ? simpleString(args[0]) : simpleString("PONG");
}

async function handleSet(args: string[]): Promise<string> {
  if (args.length < 2) {
    return "-ERR wrong number of arguments for 'set' command\r\n";
  }
  const [key, value, option, time] = args;
  const storeValue: StoreValue = { value };
  if (option?.toLowerCase() == "px" && typeof Number(time) === "number") {
    storeValue["expiration"] = createExpirationDate(Number(time));
  }
  store.set(key, storeValue);

  replicaConnections.forEach(async (connection) => {
    connection.write(arrToRESP(["SET", ...args]));
  });
  return simpleString("OK");
}

function handleGet(args: string[]): string {
  if (args.length !== 1) {
    return "-ERR wrong number of arguments for 'get' command\r\n";
  }
  const key = args[0];
  const storeValue = store?.get(key);
  if (!storeValue) return bulkString();
  if (isExpired(storeValue?.expiration)) {
    store.delete(key);
    return bulkString();
  }
  return bulkString(storeValue.value);
}

function handleDel(args: string[]): string {
  if (args.length === 0) {
    return "-ERR wrong number of arguments for 'del' command\r\n";
  }
  let deletedCount = 0;
  args.forEach((key) => {
    if (store.delete(key)) {
      deletedCount++;
    }
  });
  replicaConnections.forEach((connection) => {
    connection.write(arrToRESP(["del", ...args]));
  });
  return `:${deletedCount}\r\n`;
}

function handleEcho(args: string[]) {
  return args.length > 0 ? simpleString(args[0]) : simpleString("");
}

function handleConfig(args: string[]) {
  const params = parseArguments();
  if (args.length < 2) {
    return "-ERR wrong number of arguments for 'CONFIG' command\r\n";
  }
  const [command, key] = args;
  if (command.toUpperCase() == "GET") {
    const value = params[key];
    if (!value) return "-ERR unknown command\r\n";
    return arrToRESP([key, value]);
  }

  return "-ERR unknown command\r\n";
}

async function handleRDB(args: string[]) {
  const searchKey = args[0] || "*";
  if (searchKey == "*") return arrToRESP(store.getKeys());
  return arrToRESP(store.getKeys().filter((key) => key.includes(searchKey)));
}

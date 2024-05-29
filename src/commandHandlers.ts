import { loadRdb } from "./rdbParser";
import { RedisStore } from "./store";
import { StoreValue, StreamEntries } from "./types";
import {
  arrToRESP,
  bulkString,
  createExpirationDate,
  getType,
  isExpired,
  parseArguments,
  parseStreamEntries,
  rdbConfig,
  simpleString,
} from "./utils";

// In-memory key-value store
const kvStore = loadRdb(rdbConfig);
const store = new RedisStore(Object.entries(kvStore));

export async function handleCommand(command: string[]): Promise<string> {
  const [cmd, ...args] = command;

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
      return handleStreams(args);
    default:
      return "-ERR unknown command\r\n";
  }
}

function handleStreams(args: string[]) {
  if (args.length < 4)
    return "-ERR wrong number of arguments for 'xadd' command\r\n";
  const [streamKey, ...rest] = args;
  const streamValue = parseStreamEntries(rest);
  const oldStream = store.get(streamKey);
  if (oldStream) {
    const parsedStream = JSON.parse(oldStream.value) as StreamEntries;
    console.log("parsedStream", parsedStream);
    const newStream = { ...streamValue, ...parsedStream };
    store.set(streamKey, {
      value: JSON.stringify(newStream),
      expiration: oldStream.expiration,
    });
  }
  store.set(streamKey, { value: JSON.stringify(streamValue) });
  return bulkString(Object.keys(streamValue)[0]);
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

function handleSet(args: string[]): string {
  if (args.length < 2) {
    return "-ERR wrong number of arguments for 'set' command\r\n";
  }
  const [key, value, option, time] = args;
  const storeValue: StoreValue = { value };
  if (option?.toLowerCase() == "px" && typeof Number(time) === "number") {
    storeValue["expiration"] = createExpirationDate(Number(time));
  }
  store.set(key, storeValue);
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

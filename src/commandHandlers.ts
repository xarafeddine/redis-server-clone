import { loadRdb } from "./rdbParser";
import { RedisStore } from "./store";
import {
  arrToRESP,
  bulkString,
  parseArguments,
  rdbConfig,
  simpleString,
} from "./utils";

// In-memory key-value store
const store = new RedisStore();
const kvStore = loadRdb(rdbConfig);
Object.entries(kvStore).forEach(([key, { value }]) => {
  store.set(key, value);
});

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
    default:
      return "-ERR unknown command\r\n";
  }
}

function handlePing(args: string[]): string {
  return args.length > 0 ? simpleString(args[0]) : simpleString("PONG");
}

function handleSet(args: string[]): string {
  if (args.length < 2) {
    return "-ERR wrong number of arguments for 'set' command\r\n";
  }
  const [key, value, option, time] = args;
  store.set(key, value);
  console.log(option, time);
  if (option?.toLowerCase() == "px" && typeof Number(time) === "number") {
    console.log("timeout");
    setTimeout(() => {
      store.delete(key);
    }, Number(time));
  }
  return simpleString("OK");
}

function handleGet(args: string[]): string {
  if (args.length !== 1) {
    return "-ERR wrong number of arguments for 'get' command\r\n";
  }
  const key = args[0];
  const value = store.get(key);
  return bulkString(value);
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
  let response;
  if (searchKey == "*") response = arrToRESP(store.getKeys());
  else {
    const value = store.get(searchKey);
    response = arrToRESP(value == undefined ? [] : [value]);
  }

  return response;
}

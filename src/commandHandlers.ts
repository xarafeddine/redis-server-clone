import { RedisStore } from "./store";
import { bulkString, simpleString } from "./utils";

// In-memory key-value store
const store = new RedisStore();

export function handleCommand(command: string[]): string {
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

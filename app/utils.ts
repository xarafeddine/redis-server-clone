import { Socket } from "net";

export const simpleString = (reply: string) => `+${reply}\r\n`;
export const bulkString = (reply: string) => `$${reply.length}\r\n${reply}\r\n`;
const db = new Map();

export function handleConnection(connection: Socket, data: Buffer) {
  console.log(data.toString());
  const [numOfArgs, ...rest] = data.toString().split("\r\n");
  const [commandLength, command, ...args] = rest;
  switch (command.toLocaleLowerCase()) {
    case "command":
      break;
    case "echo":
      connection.write(bulkString(args[1]));
      break;
    case "ping":
      connection.write(simpleString("PONG"));
      break;
    case "set":
      db.set(args[1], args[2]);
      connection.write(simpleString("OK"));
      break;
    case "get":
      const value = db.get(args[1]);
      connection.write(bulkString(value));
      break;
    default:
      connection.write(simpleString(`Unknown command: ${command}`));
  }
}

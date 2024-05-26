import { Socket } from "net";

export const simpleString = (reply: string) => `+${reply}\r\n`;
export const bulkString = (reply: string) => `$${reply.length}\r\n${reply}\r\n`;
const db = new Map();

export function handleConnection(connection: Socket, data: Buffer) {
  const [numOfArgs, ...rest] = data.toString().split("\r\n");
  const [commandLength, command, ...args] = rest;
  console.log(rest);
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
      db.set(args[1], args[3]);
      if (args[5] != undefined && args[5].toLowerCase() === "px") {
        setTimeout(() => {
          db.delete(args[1]);
        }, +args[7]);
      }
      connection.write(simpleString("OK"));
      break;
    case "get":
      const value = db.get(args[1]);
      console.log(value);
      if (value === undefined) return connection.write("$-1\r\n");
      connection.write(bulkString(value));
      break;
    default:
      connection.write(simpleString(`Unknown command: ${command}`));
  }
}

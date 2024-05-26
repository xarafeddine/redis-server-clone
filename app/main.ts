import * as net from "node:net";
import { bulkString, handleConnection, simpleString } from "./utils";

const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
  console.log("init\n");
  connection.on("connect", () => {
    console.log("Client connected\n");
  });
  connection.on("ready", () => {
    console.log("ready\n");
  });

  connection.on("data", (data) => {
    handleConnection(connection, data);
  });
  connection.on("end", () => {
    console.log("end\n");
  });
  connection.on("close", () => {
    console.log("close\n");
  });
  connection.on("error", (error: Error) => {
    console.log(`Error: ${error}\n`);
  });
});
const PORT = 6379;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Server listening on 127.0.0.1:${PORT}\n`);
});
// Bun.listen({
//   hostname: "127.0.0.1",
//   port: 6379,
//   socket: {
//     data(socket, data) {
//       socket.write("+PONG\r\n");
//     },
//     //   open(socket) {
//     //     socket.data = { sessionId: "abcd" };
//     //   },
//   },
// });

import * as net from "net";
import { handleCommand } from "./commandHandlers";
import { parseRESP } from "./utils";

const PORT = 6379;
const HOST = "127.0.0.1";

// Create a TCP server
const server = net.createServer((connection) => {
  console.log("Client connected");

  // Handle data received from the client
  connection.on("data", (data) => {
    console.log("Received data:", data.toString());

    try {
      const command = parseRESP(data);
      const response = handleCommand(command);
      console.log("Sent data ", response);
      connection.write(response);
    } catch (error) {
      console.error("Error processing command:", error);
      connection.write("-ERR internal server error\r\n");
    }
  });

  // Handle client disconnection
  connection.on("end", () => {
    console.log("Client disconnected");
  });

  // Handle connection errors
  connection.on("error", (err) => {
    console.error("Connection error:", err);
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on ${HOST}:${PORT}`);
});

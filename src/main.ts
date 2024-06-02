import net from "net";
import { handleCommand, handleMasterCommand } from "./commandHandlers";
import {
  arrToRESP,
  initMaster,
  parseRESP,
  rdbConfig,
  serverParams,
  simpleString,
} from "./utils";
import { loadRdb } from "./rdbParser";
import { RedisStore } from "./store";

const PORT = Number(serverParams.port) || 6379;
const HOST = "127.0.0.1";

// In-memory key-value store
const kvStore = loadRdb(rdbConfig);
export const store = new RedisStore(Object.entries(kvStore));
export const replicaConnections: net.Socket[] = [];

export const isMaster = initMaster();
if (!isMaster) {
  let fist_REPLCONF_sent = false;
  const offset = { value: 0, isActive: false };
  const client = net.createConnection(
    { port: +serverParams.masterPort },
    () => {
      console.log("-client: Connected to the master server");
      client.write(arrToRESP(["ping"]));
    }
  );

  client.on("data", async (data) => {
    const receivedData = data.toString();
    offset.value += Buffer.byteLength(receivedData, "utf8");
    console.log("-client: Received from the master server:", receivedData);

    if (receivedData == simpleString("PONG"))
      client.write(arrToRESP(["REPLCONF", "listening-port", `${PORT}`]));
    else if (receivedData == simpleString("OK")) {
      if (!fist_REPLCONF_sent) {
        client.write(arrToRESP(["REPLCONF", "capa", "psync2"]));
        fist_REPLCONF_sent = true;
      } else {
        client.write(arrToRESP(["PSYNC", "?", "-1"]));
      }
    } else handleMasterCommand(receivedData, client, offset);
  });

  client.on("end", () => {
    console.log("-client: Disconnected from the master server");
  });

  client.on("error", (err) => {
    console.error("-client: Client error:", err);
  });
}

// Create a TCP server
const server = net.createServer((connection: net.Socket) => {
  console.log("Client connected");

  // Handle data received from the client
  connection.on("data", async (data) => {
    console.log("Received data:", parseRESP(data.toString()));

    try {
      const command = parseRESP(data.toString());
      const response = await handleCommand(command, connection);
      if (!response) return;
      console.log("Sent data ", parseRESP(response));
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

export function parseRESP(buffer: Buffer): string[] {
  const data = buffer.toString();
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
export const bulkString = (reply?: string) =>
  reply ? `$${reply.length}\r\n${reply}\r\n` : "$-1\r\n";

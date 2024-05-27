import * as fs from "fs";
import path from "path";
import { RDBFilePath } from "./utils";

const REDIS_RDB_OPCODE_EXPIRETIME_MS = 252;
const REDIS_RDB_OPCODE_EXPIRETIME = 253;
const REDIS_RDB_OPCODE_SELECTDB = 254;
const REDIS_RDB_OPCODE_EOF = 255;

const RDB_TYPE_STRING = 0;

export class BinaryReader {
  buffer: Buffer;
  offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readByte(): number {
    return this.buffer.readUInt8(this.offset++);
  }

  readUInt32(): number {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readString(length: number): string {
    const value = this.buffer.toString(
      "utf8",
      this.offset,
      this.offset + length
    );
    this.offset += length;
    return value;
  }

  readLength(): number {
    const length = this.readByte();
    if (length & 0x80) {
      // Large length encoded in next bytes
      if (length & 0x40) {
        // Two-byte length
        return ((length & 0x3f) << 8) | this.readByte();
      } else {
        // Five-byte length
        return ((length & 0x3f) << 32) | this.readUInt32();
      }
    }
    return length;
  }
}
("settings.json");

// function createRDBFile(filePath: string) {
//   const buffer = Buffer.from([
//     0x52,
//     0x45,
//     0x44,
//     0x49,
//     0x53, // "REDIS"
//     0x30,
//     0x30,
//     0x30,
//     0x39, // Version "0009"
//     0xfe,
//     0x00, // SELECTDB opcode, DB number 0
//     0x00, // String type
//     0x08, // Key length: 8 bytes
//     0x74,
//     0x65,
//     0x73,
//     0x74,
//     0x5f,
//     0x6b,
//     0x65,
//     0x79, // "test_key"
//     0x0a, // Value length: 10 bytes
//     0x74,
//     0x65,
//     0x73,
//     0x74,
//     0x5f,
//     0x76,
//     0x61,
//     0x6c,
//     0x75,
//     0x65, // "test_value"
//     0xff, // EOF opcode
//   ]);

//   fs.writeFileSync(path.resolve(__dirname, filePath), buffer);
// }

function createRDBFile(filePath: string) {
  const buffer = [];

  // RDB header
  buffer.push(Buffer.from("REDIS"));
  buffer.push(Buffer.from("0009"));

  // SELECTDB opcode (0xFE) and DB number (0x00)
  buffer.push(Buffer.from([0xfe, 0x00]));

  // String key-value pair
  const key = "test_key";
  const value = "test_value";
  const keyBuffer = Buffer.from(key, "utf8");
  const valueBuffer = Buffer.from(value, "utf8");

  // Type: String (0x00)
  buffer.push(Buffer.from([0x00]));
  // Key length
  buffer.push(encodeLength(keyBuffer.length));
  // Key
  buffer.push(keyBuffer);
  // Value length
  buffer.push(encodeLength(valueBuffer.length));
  // Value
  buffer.push(valueBuffer);

  // EOF opcode (0xFF)
  buffer.push(Buffer.from([0xff]));

  // Write to file
  const finalBuffer = Buffer.concat(buffer);
  fs.writeFileSync(path.resolve(__dirname, filePath), buffer.toString());
}

function encodeLength(length: number) {
  if (length < 0x40) {
    return Buffer.from([length]);
  } else if (length < 0x4000) {
    return Buffer.from([(length >> 8) | 0x80, length & 0xff]);
  } else {
    throw new Error("Length encoding for larger values not implemented");
  }
}
export async function parseRDB(
  filePath: string,
  searchKey: string
): Promise<any> {
  createRDBFile(filePath);
  const buffer = fs.readFileSync(filePath);
  const reader = new BinaryReader(buffer);

  // Read header
  const header = reader.readString(5);
  if (!header.startsWith("REDIS")) {
    throw new Error("Invalid RDB file.");
  }

  // Read version
  const version = reader.readString(4);
  console.log(`RDB version: ${version}`);

  // Parse the RDB file
  while (reader.offset < buffer.length) {
    const type = reader.readByte();
    if (type === REDIS_RDB_OPCODE_EOF) {
      break;
    }

    let key: string | null = null;

    if (type === REDIS_RDB_OPCODE_SELECTDB) {
      // Handle database selection
      reader.readLength(); // Skip the DB selector
    } else if (
      type === REDIS_RDB_OPCODE_EXPIRETIME ||
      type === REDIS_RDB_OPCODE_EXPIRETIME_MS
    ) {
      // Handle expiry times
      reader.readUInt32(); // Skip the expiry time
    } else {
      // Read the key
      key = reader.readString(reader.readLength());
      const valueType = reader.readByte();

      if (key === searchKey) {
        if (valueType === RDB_TYPE_STRING) {
          const valueLength = reader.readLength();
          const value = reader.readString(valueLength);
          return value;
        }
      } else {
        // Skip the value if the key does not match
        skipValue(reader, valueType);
      }
    }
  }

  throw new Error(`Key "${searchKey}" not found.`);
}

function skipValue(reader: BinaryReader, valueType: number): void {
  if (valueType === RDB_TYPE_STRING) {
    const valueLength = reader.readLength();
    reader.readString(valueLength); // Skip the string value
  } else {
    // Add more types as needed
    throw new Error(`Unsupported value type: ${valueType}`);
  }
}

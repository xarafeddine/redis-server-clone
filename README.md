# Redis Server Clone

A lightweight Redis server clone built using Bun and TypeScript.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)

## About

This project is a clone of the popular Redis server, implemented using the [Bun](https://bun.sh) JavaScript runtime and TypeScript. It supports basic Redis commands and is designed for learning and experimentation purposes.

## Features

- Supports basic Redis commands such as GET, SET, DEL, KEYS, PING and many others.
- Built using modern JavaScript with Bun.
- Written in TypeScript for type safety and better developer experience.
- Lightweight and easy to extend.

## Installation

### Prerequisites

- [Bun](https://bun.sh) installed on your system.
- redis-tools for an easy interaction with the redis server

### Steps

1. Clone the repository:

```sh
   git clone git@github.com:xarafeddine/redis-server-clone.git
   cd redis-server-clone
```

2. Install dependencies:

```sh
   bun install
```

3. Run the app:

```sh
   # To lunch an master server
   bun run src/main.ts --port <port> --dir <dir> --dbfilename <filename>

   # To lunch some slaves (replicas of master) servers
   bun run src/main.ts --port <PORT> --replicaof "<MASTER_HOST> <MASTER_PORT>"
```

## usage

Some commands to test

### Using redis-tools (recommended)

```sh
# Simple commands
redis-cli PING
redis-cli ECHO something
redis-cli SET mykey "Hello, World!"
redis-cli GET mykey
redis-cli DEL mykey
redis-cli CONFIG GET dir
redis-cli KEY "*"

# Working with streams
redis-cli XADD stream_key 0-1 foo bar
redis-cli TYPE stream_key
redis-cli XADD some_key "1-*" foo bar
redis-cli XADD stream_key * foo bar
redis-cli XRANGE stream_key 0-2 0-3
redis-cli XRANGE some_key - 1526985054079
redis-cli XRANGE some_key 1526985054079 +
redis-cli XREAD streams stream_key other_stream_key 0-0 0-1
redis-cli XREAD block 1000 streams some_key 1526985054069-0
redis-cli XREAD block 0 streams some_key 1526985054069-0
redis-cli XREAD block 1000 streams some_key $

# Support multiple replicas
redis-cli -p <PORT> <COMMAND> # choose a replica to connect with 
redis-cli info replication # get information about a replica
redis-cli WAIT 3 500 # (wait until either 3 replicas has processed previous commands or 500ms have passed)

```

### Using other linux tools

Note: Commands and responses are both encoded using the [Redis protocol](https://redis.io/docs/latest/develop/reference/protocol-spec/), (TL;DR: You have to send data as RESP ENCODED VALUES).

```sh
nc localhost 3000 # using netcat
telnet localhost 3000 # using telnet
curl -v telnet://localhost:3000 --data "PING" # using curl
```

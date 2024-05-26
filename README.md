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

- Supports basic Redis commands such as GET, SET, DEL, and PING.
- Built using modern JavaScript with Bun.
- Written in TypeScript for type safety and better developer experience.
- Lightweight and easy to extend.

## Installation

### Prerequisites

- [Bun](https://bun.sh) installed on your system.
- redis-tools for an esay interaction with the redis server

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
   bun run app/main.ts
```

# some commands to test

```sh
redis-cli SET mykey "Hello, World!"
redis-cli GET mykey
redis-cli PING
redis-cli DEL mykey
```

### Project Structure

```sh
redis-server-clone/
├── src/
│ ├── server.ts
│ ├── handlers/
│ │ └── commandHandlers.ts
│ ├── utils/
│ │ └── parser.ts
│ └── types/
│ └── index.ts
├── tests/
│ └── server.test.ts
├── .gitignore
├── bun.lockb
├── package.json
├── README.md
└── tsconfig.json

```

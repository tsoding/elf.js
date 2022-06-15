# elf.js

An on going project to learn ELF format. The end goal is to be able to generate simple but actually working executables.

## Quick Start

Supports only x86_64 Linux. You need only [node.js](https://nodejs.org/en/):

```console
$ node elf.js gen hello 'Hello, World'
$ ./hello
```

It literally generates a working ELF64 executable file byte by byte that prints `Hello, World` when run on Linux x86_64.

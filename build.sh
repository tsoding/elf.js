#!/bin/sh

set -xe

fasm hello.asm
chmod +x ./hello
node elf.js ./hello

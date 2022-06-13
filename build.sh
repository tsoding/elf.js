#!/bin/sh

set -xe

fasm hello.asm
node elf.js

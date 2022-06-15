// TODO: migrate to TypeScript
const fs = require('fs');

const EI_NIDENT = 16;
const ELFMAG = [127, 69, 76, 70];

const EI_CLASS = 4;
const ELFCLASSNONE = 0  /* Invalid class */
const ELFCLASS32 = 1;  /* 32-bit objects */
const ELFCLASS64 = 2;  /* 64-bit objects */
const ELFCLASSNUM = 3;

const EI_DATA  = 5;  /* Data encoding byte index */
const ELFDATANONE = 0;  /* Invalid data encoding */
const ELFDATA2LSB = 1;  /* 2's complement, little endian */
const ELFDATA2MSB = 2;  /* 2's complement, big endian */
const ELFDATANUM = 3;

const EI_VERSION = 6;  /* File version byte index */

const EI_OSABI = 7;  /* OS ABI identification */

const ELFOSABI_LABELS = {
    '0': 'SYSV',
    '1': 'HPUX',
    '2': 'NETBSD',
    '3': 'LINUX',
    '6': 'SOLARIS',
    '7': 'AIX',
    '8': 'IRIX',
    '9': 'FREEBSD',
    '10': 'TRU64',
    '11': 'MODESTO',
    '12': 'OPENBSD',
    '64': 'ARM_AEABI',
    '97': 'ARM',
    '255': 'STANDALONE',
}

const EI_ABIVERSION = 8;

const sizeOfType = {
    'u8': 1,
    'u16': 2,
    'u32': 4,
    'u64': 8,
};

sizeOfType['half'] = sizeOfType['u16'];
sizeOfType['word'] = sizeOfType['u32'];
sizeOfType['addr'] = sizeOfType['u64'];
sizeOfType['off']  = sizeOfType['u64'];
sizeOfType['xword']  = sizeOfType['u64'];

const Elf64_Ehdr = [
    ['half', 'e_type'],
    ['half', 'e_machine'],
    ['word', 'e_version'],
    ['addr', 'e_entry'],
    ['off', 'e_phoff'],
    ['off', 'e_shoff'],
    ['word', 'e_flags'],
    ['half', 'e_ehsize'],
    ['half', 'e_phentsize'],
    ['half', 'e_phnum'],
    ['half', 'e_shentsize'],
    ['half', 'e_shnum'],
    ['half', 'e_shstrndx'],
];

const Elf64_Phdr = [
    ['word', 'p_type'],
    ['word', 'p_flags'],
    ['off', 'p_offset'],
    ['addr', 'p_vaddr'],
    ['addr', 'p_paddr'],
    ['xword', 'p_filesz'],
    ['xword', 'p_memsz'],
    ['xword', 'p_align'],
];

function serializeStruct(scheme, struct, endian) {
    console.assert(endian === 'LSB');
    // TODO: Get rid of Buffer. It is Node.js only. We need more universal code.
    const result = Buffer.alloc(sizeOfStruct(scheme));

    let bytesIndex = 0;
    for (let i = 0; i < scheme.length; ++i) {
        const [type, field] = scheme[i];
        const size = sizeOfType[type];
        const value = struct[field];
        switch (size) {
        case 1: result.writeUInt8LE(value, bytesIndex); break;
        case 2: result.writeUInt16LE(value, bytesIndex); break;
        case 4: result.writeUInt32LE(value, bytesIndex); break;
        case 8: result.writeBigUInt64LE(BigInt(value), bytesIndex); break;
        default: throw 'unreachable';
        }
        bytesIndex += size;
    }

    return result;
}

function parseStruct(scheme, bytes, endian) {
    console.assert(endian === 'LSB');
    console.assert(sizeOfStruct(scheme) === bytes.length);

    const result = {};
    let bytesIndex = 0;
    for (let i = 0; i < scheme.length; ++i) {
        const [type, field] = scheme[i];
        const size = sizeOfType[type];
        switch (size) {
        case 1: result[field] = bytes.readUInt8LE(bytesIndex); break;
        case 2: result[field] = bytes.readUInt16LE(bytesIndex); break;
        case 4: result[field] = bytes.readUInt32LE(bytesIndex); break;
        case 8: result[field] = Number(bytes.readBigUInt64LE(bytesIndex)); break;
        default: throw 'unreachable';
        }
        bytesIndex += size;
    }
    return result;
}

function sizeOfStruct(scheme) {
    let size = 0;
    for (let i = 0; i < scheme.length; ++i) {
        size += sizeOfType[scheme[i][0]];
    }
    return size;
}

function verifyElfMag(bytes) {
    for (let i = 0; i < 4; ++i) {
        if (bytes[i] != ELFMAG[i]) {
            return false;
        }
    }
    return true;
}

function getPhdrByIndex(fd, ehdr, index) {
    const phdrBuffer = Buffer.alloc(sizeOfStruct(Elf64_Phdr));
    const offset = ehdr.e_phoff + index*ehdr.e_phentsize;
    fs.readSync(fd, phdrBuffer, 0, sizeOfStruct(Elf64_Phdr), offset);
    const phdr = parseStruct(Elf64_Phdr, phdrBuffer, 'LSB');
    return phdr;
}

const RAX = 0xC0;
const RDI = 0xC7;
const RSI = 0xC6;
const RDX = 0xC2;

function syscall() {
    return Buffer.from([0x0f, 0x05]);
}

function mov(reg, value) {
    const inst = Buffer.from([0x48, 0xc7, 0, 0, 0, 0, 0]);
    inst.writeUInt8(reg, 2);
    inst.writeUInt32LE(value, 3);
    return inst;
}

const SYS_write = 1;
const SYS_exit = 60;
const STDOUT = 1;

function write(hello, hello_sz) {
    return Buffer.concat([
        mov(RAX, SYS_write),
        mov(RDI, STDOUT),
        mov(RSI, hello),
        mov(RDX, hello_sz),
        syscall()
    ]);
}

function exit(code) {
    return Buffer.concat([
        mov(RAX, SYS_exit),
        mov(RDI, code),
        syscall()
    ]);
}

function helloWorldProgram(hello, hello_sz) {
    return Buffer.concat([
        // write(hello, hello_sz),
        write(hello, hello_sz),
        exit(0),
    ]);
}

const subcmds = {
    'parse': {
        'description': 'Parse provided executable',
        'args': '<FILE>',
        'run': parseExecutable,
    },

    'gen': {
        'description': 'Generate a new test executable that prints specified message',
        'args': '<FILE> <MESSAGE>',
        'run': generateExecutable,
    },

    'help': {
        'description': 'Print this help message',
        'args': '[SUBCOMMAND]',
        'run': (name) => {
            if (name) {
                const subcmd = subcmds[name];
                console.error(`Usage: node elf.js ${name} ${subcmd.args}`);
                console.error(`Description:`);
                console.error(`    ${subcmd.description}`);
            } else {
                console.error('Usage: node elf.js [SUBCOMMAND] [ARGUMENTS]');
                console.error('SUBCOMMANDS:');
                for (let name in subcmds) {
                    console.log(`    ${name} ${subcmds[name].args} - ${subcmds[name].description}`);
                }
            }
        }
    },
};

function parseExecutable(argv) {
    const FILE_PATH = argv[0];

    if (!FILE_PATH) {
        subcmds.help.run('parse');
        console.error('ERROR: No executable file is provided');
        process.exit(1);
    }

    const fd = fs.openSync(FILE_PATH, 'r')

    // TODO: use serialization "framework" for parsing e_ident

    const n = 16;
    const e_ident = Buffer.alloc(n);
    fs.readSync(fd, e_ident, 0, n, null);
    if (!verifyElfMag(e_ident.slice(0, 4))) {
        console.error("ERROR: Invalid ELF magic");
        return;
    }

    console.log(e_ident);

    if (e_ident[EI_CLASS] == ELFCLASS32) {
        console.log("Class: ELF32");
    } else if (e_ident[EI_CLASS] == ELFCLASS64) {
        console.log("Class: ELF64");
    } else {
        console.error("ERROR: invalid EI_CLASS ${e_ident[EI_CLASS]}");
        return;
    }

    if (e_ident[EI_DATA] == ELFDATA2LSB) {
        console.log("Data: 2's complement, little endian");
    } else if (e_ident[EI_DATA] == ELFDATA2MSB) {
        console.log("Data: 2's complement, big endian");
    } else {
        console.error("ERROR: invalid EI_DATA ${e_ident[EI_DATA]}");
        return;
    }

    console.log(`Version: ${e_ident[EI_VERSION]}`);
    console.log(`OS/ABI: ${ELFOSABI_LABELS[e_ident[EI_OSABI]]}`);
    console.log(`ABI Version: ${e_ident[EI_ABIVERSION]}`)

    console.log();
    console.log("Ehdr:");
    const ehdrBuffer = Buffer.alloc(sizeOfStruct(Elf64_Ehdr));
    fs.readSync(fd, ehdrBuffer, 0, sizeOfStruct(Elf64_Ehdr), null);
    // TODO: unhardcode endianess parsing
    const ehdr = parseStruct(Elf64_Ehdr, ehdrBuffer, 'LSB');
    console.log(ehdr);
    
    console.log();
    console.log("Phdrs:");
    for (let i = 0; i < ehdr.e_phnum; ++i) {
        console.log(getPhdrByIndex(fd, ehdr, i));
    }

    // * * * * * *
    // 5 6 7 8 9 10
    // ^     ^
    //
    // 6 - 3

    console.log();
    console.log("Machine Code:");
    const dataPhdr = getPhdrByIndex(fd, ehdr, 0);

    const offset = dataPhdr.p_offset + ehdr.e_entry - dataPhdr.p_vaddr;
    const filesz = dataPhdr.p_filesz - offset;
    const dataBuffer = Buffer.alloc(filesz);
    fs.readSync(fd, dataBuffer, 0, filesz, offset);
    console.log(dataBuffer);
}

function generateExecutable(args) {
    const e_ident = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    const FILE_PATH = args[0];
    if (!FILE_PATH) {
        subcmds.help.run('gen');
        console.error('ERROR: no file path is provided');
        process.exit(1);
    }

    const data = args[1];
    if (!data) {
        subcmds.help.run('gen');
        console.error('ERROR: no message is provided');
        process.exit(1);
    }

    const fd = fs.openSync(FILE_PATH, 'w');
    fs.writeSync(fd, e_ident);

    const ehdr = {
        e_type: 2,
        e_machine: 62,
        e_version: 1,
        e_entry: 4194480,
        e_phoff: 64,
        e_shoff: 0,
        e_flags: 0,
        e_ehsize: 64,
        e_phentsize: 56,
        e_phnum: 2,
        e_shentsize: 64,
        e_shnum: 0,
        e_shstrndx: 0
    };

    fs.writeSync(fd, serializeStruct(Elf64_Ehdr, ehdr, 'LSB'));

    const dataStartAddr = 4198622;
    const eIdentSize = 16;
    const elfGarbageSize = eIdentSize + sizeOfStruct(Elf64_Ehdr) + sizeOfStruct(Elf64_Phdr)*2;
    const machineCode = helloWorldProgram(dataStartAddr, data.length);

    const codePhdr = {
        p_type: 1,
        p_flags: 5,
        p_offset: 0,
        p_vaddr: 4194304,
        p_paddr: 4194304,
        p_filesz: elfGarbageSize + machineCode.length,
        p_memsz: elfGarbageSize + machineCode.length,
        p_align: 4096
    };
    // console.log(codePhdr);
    fs.writeSync(fd, serializeStruct(Elf64_Phdr, codePhdr, 'LSB'));

    const dataPhdr = {
        p_type: 1,
        p_flags: 6,
        p_offset: elfGarbageSize + machineCode.length,
        p_vaddr: dataStartAddr,
        p_paddr: dataStartAddr,
        p_filesz: data.length,
        p_memsz: data.length,
        p_align: 4096
    };
    // console.log(dataPhdr);
    fs.writeSync(fd, serializeStruct(Elf64_Phdr, dataPhdr, 'LSB'));
    fs.writeSync(fd, machineCode);
    fs.writeSync(fd, data);
    fs.closeSync(fd);

    fs.chmodSync(FILE_PATH, 0755);
}


function usage() {
    console.error('Usage: node elf.js [SUBCOMMAND] [ARGUMENTS]');
    console.error('SUBCOMMANDS:');
}

function main() {
    const subcmd = subcmds[process.argv[2]];
    if (!subcmd) {
        subcmds.help.run();
        console.error('ERROR: no subcommand is provided');
        process.exit(1);
    }

    subcmd.run(process.argv.slice(3));
}

main();

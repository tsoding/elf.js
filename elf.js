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

const EI_OSABI            = 7;  /* OS ABI identification */

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

const FILE_PATH = './hello';

function parseUnsignedInt(bytes, endian) {
    switch (endian) {
    case 'LSB': {
        let value = 0;
        for (let i = bytes.length - 1; i >= 0; --i) {
            value = value*0x100 + bytes[i];
        }
        return value;
    } break;

    case 'MSB': {
        console.error('MSB is not implemented yet');
    } break;

    default: {
        console.error("Unsuported endianess");
    }
    }
}

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

function parseStruct(scheme, bytes, endian) {
    const result = {};
    let bytesIndex = 0;
    for (let i = 0; i < scheme.length; ++i) {
        const [type, field] = scheme[i];
        if (bytesIndex + sizeOfType[type] > bytes.length) {
            return null;
        }
        result[field] = parseUnsignedInt(bytes.slice(bytesIndex, bytesIndex + sizeOfType[type]), endian);
        bytesIndex += sizeOfType[type];
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

fs.open(FILE_PATH, 'r', (status, fd) => {
    if (status) {
        console.error(status);
        return;
    }

    const n = 16;
    const e_ident = Buffer.alloc(n);
    fs.readSync(fd, e_ident, 0, n, null);
    if (!verifyElfMag(e_ident.slice(0, 4))) {
        console.error("ERROR: Invalid ELF magic");
        return;
    }

    console.log("YEP! This is an ELF file");

    if (e_ident[EI_CLASS] == ELFCLASS32) {
        console.log("32 bit");
    } else if (e_ident[EI_CLASS] == ELFCLASS64) {
        console.log("64 bit");
    } else {
        console.error("ERROR: invalid EI_CLASS ${e_ident[EI_CLASS]}");
        return;
    }

    if (e_ident[EI_DATA] == ELFDATA2LSB) {
        console.log("Little endian");
    } else if (e_ident[EI_DATA] == ELFDATA2MSB) {
        console.log("Big endian");
    } else {
        console.error("ERROR: invalid EI_DATA ${e_ident[EI_DATA]}");
        return;
    }

    console.log(`Version ${e_ident[EI_VERSION]}`);
    console.log(`ABI: ${ELFOSABI_LABELS[e_ident[EI_OSABI]]}`);
    console.log(`ABI version: ${e_ident[EI_ABIVERSION]}`)

    const ehdrBuffer = Buffer.alloc(sizeOfStruct(Elf64_Ehdr));
    fs.readSync(fd, ehdrBuffer, 0, sizeOfStruct(Elf64_Ehdr), null);
    const ehdr = parseStruct(Elf64_Ehdr, ehdrBuffer, 'LSB');
    console.log(ehdr);

    for (let i = 0; i < ehdr.e_phnum; ++i) {
        console.log(getPhdrByIndex(fd, ehdr, i));
    }

    console.log("OK");
});

format ELF64 executable 3

SYS_write = 1
SYS_exit = 60
STDOUT = 1

segment readable executable
start:
    mov rax, SYS_write
    mov rdi, STDOUT
    mov rsi, hello
    mov rdx, hello_sz
    syscall

    mov rax, SYS_exit
    mov rdi, 0
    syscall

segment readable writable
hello: db "Hello, World!", 10
hello_sz = $-hello

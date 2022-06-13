format ELF64 executable 3
segment readable executable
entry start
start:
    mov rax, 1
    mov rdi, 1
    mov rsi, 4194305
    mov rdx, 3
    syscall

    ; mov rax, 1
    ; mov rdi, 1
    ; mov rsi, hello
    ; mov rdx, 8
    ; syscall

    mov rax, 60
    mov rdi, 0
    syscall

segment readable writable
hello: db "Ur Mom!", 10

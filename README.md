# WebLc3
Platform for prototyping LC3 programs. This project implements a superset of the specification as defined by Yale N. Patt at the University of Texas at Austin and Sanjay J. Patel at the University of Illinois at Urbana–Champaign in the second edition of their textbook.

## Virtual Machine Extensions
This machine is entirely binary-compatible with assembled LC3 programs. The following extensions have been applied to the virtual machine to give new meaning to previously-undefined instructions.
* JMP now supports label addressing, as JSR already does.
* NOT is implemented as XOR with the same semantics as ADD and ADD.
    * note that XOR is not directly supported in the assembler, but a macro simulates its use using .FILL directives.

## Assembler Extensions
This assembler is entirely compatible LC3 assembly programs. The following extensions have been applied to the assembler to give new meaning to previously-undefined syntax.
* JMP and JSR both support labels and registers; JSRR still only supports registers.
* Support for local labels has been added. Local labels start with a $ symbol and their visibility is limited to the nearest non-local label in either direction. These labels

The assembler also includes macro support. To bypass macros, prefix commands with the @ symbol (e.g. @add r0, r1, #5).

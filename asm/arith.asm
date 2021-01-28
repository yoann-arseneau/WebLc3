            .orig x3000

main        LD r6, $STACK
            LD r0, $number
            LEA r1, $buffer
            JSR itoa
            
            HALT
$number     .FILL #3156
$buffer     .BLKW #6
$STACK      .FILL xFE00

            ;mulu lhs:r0, rhs:r1 -> result:r0
mulu        STR r1, r6, #-1
            STR r2, r6, #-2
            CLR r2
            TEST r1
            BR $cond
$loop       ADD r2, r2, r0
            ADD r1, r1, #-1
$cond       BRnp $loop
            MOV r0, r2
            LDR r1, r6, #-1
            LDR r2, r6, #-2
            RET

            ;divu lhs:r0, rhs:r1 -> quo:r0, rem:r1
divu        STR r2, r6, #-1
            STR r3, r6, #-2
            CLR r2
            BR $cond
$loop       MOV r0, r3
            ADD r2, r2, #1
$cond       SUB r3, r0, r1 ; cmp r0, r1
            BRp $loop      ; r0 > r1: GOTO $loop
            BRn $end       ; r0 < r1: GOTO $end
            ADD r2, r2, #1 ; r0 = r1: quo += 1 THEN GOTO $end
$end        MOV r1, r0
            MOV r0, r2
            LDR r2, r6, #-1
            LDR r3, r6, #-2
            RET

            ;itoa(value: r0, buffer:r1)
itoa        TEST r0
            BRz $qend ; quick path for zero
            ; call setup
            STR r0, r6, #-1
            STR r1, r6, #-2
            STR r2, r6, #-3
            STR r3, r6, #-4
            STR r4, r6, #-5
            STR r5, r6, #-6
            BRn $neg
            CLR r2        ; setup for positive
            ST r2, $isneg ; "
            BR $part
$neg        NEG r0, r0    ; setup for negative
            ST r0, $isneg ; "
$part       MOV r2, r1
            MOV r3, #0
            LEA r4, $tmp
            ; r0:value r1:rem r2:&buffer r3:i r4:&tmp
            
            ; generate      ; do {
$loop       LD r1, $ten     ;   { value:r0, rem:r1 } = div(value, 10)
            JSR divu        ;   "
            LD r5, $zero    ;   r1 = rem + '0'
            ADD r1, r1, r5  ;   "
            STR r1, r4, #0  ;   *tmp = r1
            ADD r4, r4, #1  ;   tmp += 1
            ADD r3, r3, #1  ;   i += 1
            TEST r0         ; } while r0 > 0
            BRp $loop       ; "
            ; handle isneg
            LD r0, $isneg   ; if $isneg:
            BRz $out        ; "
            LD r0, $minus   ;   *buffer = '-'
            STR r0, r2, #0  ;   "
            ADD r2, r2, #1  ;   buffer += 1
            ; copy output   ; do {
$out        ADD r3, r3, #-1 ;   i -= 1
            ADD r4, r4, #-1 ;   tmp -= 1
            LDR r0, r4, #0  ;   *buffer = *tmp
            STR r0, r2, #0  ;   "
            ADD r2, r2, #1  ;   buffer += 1
            TEST r0         ; } while r0 > 0;
            BRp $out        ; "
            ; add null terminator
            CLR r0          ; *buffer = 0
            STR r0, r2, #0  ; "
            ; return
            LDR r0, r6, #-1
            LDR r1, r6, #-2
            LDR r2, r6, #-3
            LDR r3, r6, #-4
            LDR r4, r6, #-5
            LDR r5, r6, #-6
            RET
            
            ; quick handling for zero
$qend       LD r0, $zero
            STR r0, r1, #0
            CLR r0
            STR r0, r1, #1
            RET

$isneg      .BLKW #1
$tmp        .BLKW #6
$ten        .FILL #10
$zero       .FILL '0'
$minus      .FILL '-'


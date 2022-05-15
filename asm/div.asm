            .orig x3000

main        LD r6, $STACK
            LD r0, $number
            LD r1, $ten
            JSR div
            HALT

$number     .FILL #3156
$ten        .FILL #10
$STACK      .FILL xFE00

            ;div lhs:r0, rhs:r1 -> quo:r0, rem:r1
div         TEST r0
            BRz $zero
            TEST r1
            BRz $zero
            STR r2, r6, #-1
            STR r3, r6, #-2
            ; negative handling
            CLR r2 ; neg_quo
            CLR r3 ; neg_rem
$lhs        TEST r0
            BRzp $rhs
            NEG r0, r0
            NOT r2, r2
$rhs        TEST r1
            BRp $start
            NEG r1, r1
            NOT r2, r2
            NOT r3, r3
$start      ST r2, $neg_quo
            ST r3, $neg_rem
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
$zero       MOV r0, #0
            MOV r1, #0
            RET

$neg_quo    .BLKW #1
$neg_rem    .BLKW #1

            ; itoa i:r0, str:r1
itoa        TEST r0
            BRz $dozero
            STR r2, r6, #-1
            STR r6, r6, #-2
            SUB r6, r6, #2
            CLR r2
            TEST r0
            BRn $start
            NEG r0, r0
            NOT r2, r2
$start      ST r2, $neg
            MOV r2, r1
            LD r1, $ten
            JSR div
            LD r4, $zero
            ADD r4, r1, r4
            STR r4, r3, #0
            ADD r3, r3, #1

$dozero     LD r0, $zero
            STR r0, r1, #0
            CLR r0
            STR r0, r1, #1
            RET

$neg        .BLKW #1
$buffer     .BLKW #6
$zero       .FILL '0'
$ten        .FILL #10

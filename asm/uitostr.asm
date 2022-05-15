            .orig x3000

main        LD r6, $stack
            LD r0, $num   ; printn 3156
            JSR printn    ; -
            LEA r0, $div  ; print " / "
            PUTS          ; -
            LD r0, $denom ; printn 15
            JSR printn    ; -
            LEA r0, $eq   ; print " = "
            PUTS          ; -
            LD r0, $num   ; r0, r1 = (3156 / 15, 3156 % 15)
            LD r1, $denom ; -
            JSR divu      ; -
            JSR printn    ; printn r0
            LEA r0, $rem  ; print " rem "
            PUTS          ; -
            MOV r0, r1    ; print r1
            JSR printn    ; -
            HALT          ; abort()

$stack      .FILL xFE00
$num        .FILL #3156
$denom      .FILL #15
$div        .STRINGZ " / "
$eq         .STRINGZ " = "
$rem        .STRINGZ " rem "

printn      SUB r6, r6, #3
            STR r1, r6, #0
            STR r2, r6, #1
            STR r7, r6, #2
            LEA r1, $buf
            LD r2, $base
            JSR uitostr
            MOV r0, r1
            PUTS
            LDR r1, r6, #0
            LDR r2, r6, #1
            LDR r7, r6, #2
            ADD r6, r6, #3
            RET

$buf        .BLKW #6
$base       .FILL #10

;divu(r0:num, r1:denom) -> r0:quo, r1:rem {
divu        TEST r1        ; if r1 == 0 goto $bad
            BRz $bad       ; -

            SUB r6, r6, #1 ; stackalloc 1
            STR r2, r6, #0 ; save r2
            CLR r2         ; r2 = 0
                           ; do {
$loop       ADD r2, r2, #1 ;   r2 += 1
            SUB r0, r0, r1 ;   r0 -= r1
            BRzp $loop     ; } while (r0 >= 0);
            ADD r1, r0, r1 ; r1 = r0 + r1
            SUB r0, r2, #1 ; r0 = r2 - 1
            LDR r2, r6, #0 ; restore r2
            ADD r6, r6, #1 ; stackfree 1
            RET            ; return

$bad        MOV r1, #-1
            RET

;int uitostr(unsigned int value, char *str, unsigned int base) {
;	if (value == 0) {
;		str[0] = '0';
;		str[1] = 0;
;		return 1;
;	}
;	if (base == 0) {
;		puts("uitostr:base=0 not implemented");
;		abort();
;	}
;	if (base != 10) {
;		puts("uitostr:base!=10 not implemented");
;		abort();
;	}
;
;	char *left = str;
;	int len = 0;
;	while (value) {
;		int quo = value / 10;
;		int rem = value % 10;
;		*str++ = '0' + rem;
;		len += 1;
;	}
;	while (left != str) {
;		char temp = *left;
;		*left++ = *str;
;		*str++ = temp;
;	}
;	return len;
;}

; uitostr(r0:value, r1:str, r2:base) -> r0:len
uitostr     TEST r2           ; if r2 == 0 goto $qbadbase
            BRz $qbadbase     ; -
            SUB r6, r6, #4    ; stackalloc
            STR r3, r6, #0    ; save r3
            LD r3, $thirtysix ; if r3 > 36 goto $badbase
            SUB r3, r2, r3    ; -
            BRp $badbase      ; -
            TEST r0           ; if r0 == 0 goto $qzero
            BRz $qzero        ; -
            SUB r3, r2, #10   ; if r2 > 10 goto $big
            BRp $big          ; -

            ; small
            STR r1, r6, #1    ; save r1, r4, r7
            STR r4, r6, #2    ; -
            STR r7, r6, #3    ; -
                              ; r0:value
                              ; r1:tmp
                              ; r2:base
            MOV r3, r1        ; r3:str = r1
            CLR r4            ; r4:len = 0
                              ; r7:tmp
$small_loop MOV r1, r2        ; do {
            JSR divu          ;   r0:quo, r1:rem = divu(r0, r2)
            LD r7, $char_zero ;   *r3++ = '0' + r1
            ADD r7, r7, r1    ;   -
            STR r7, r3, #0    ;   -
            ADD r3, r3, #1    ;   -
            ADD r4, r4, #1    ;   r4 += 1
            TEST r0           ; } while (r0);
            BRnp $small_loop  ; -
            BR $swap          ; goto $swap

$big        LEA r0, $big_msg  ; puts($big_msg)
            PUTS              ; -
            HALT              ; abort()

                              ; r0:tmp
$swap       LDR r1, r6, #1    ; r1:left
                              ; r3:right
                              ; r7:tmp
            CLR r0            ; *r3-- = 0
            STR r0, r3, #0    ; -
            SUB r3, r3, #1    ; -
            BR $swap_cond     ; while (r3 < r1) {
$swap_loop  LDR r0, r3, #0    ;   swap(*r3--, *r1++)
            LDR r7, r1, #0    ;   -
            STR r7, r3, #0    ;   -
            STR r0, r1, #0    ;   -
            SUB r3, r3, #1    ;   -
            ADD r1, r1, #1    ;   -
$swap_cond  SUB r0, r3, r1    ; }
            BRp $swap_loop    ; -
            MOV r0, r4        ; return r4
            LDR r3, r6, #0    ; -
            LDR r1, r6, #1    ; -
            LDR r4, r6, #2    ; -
            LDR r7, r6, #3    ; -
            ADD r6, r6, #4    ; -
            RET               ; -

$thirtysix  .FILL #36
$char_zero  .FILL '0'

$qbadbase   CLR r0
            RET

$badbase    CLR r0
            STR r0, r2, #0
            LDR r3, r6, #1
            ADD r6, r6, #4
            RET

$qzero      LD r3, $char_zero
            STR r3, r2, #0
            CLR r0
            STR r0, r2, #1
            LDR r3, r6, #1
            ADD r6, r6, #4
            ADD r0, r0, #1
            RET

$big_msg    .stringz "uitostr:base>10 not implemented"


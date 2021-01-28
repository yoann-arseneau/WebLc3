            .ORIG x3000

            LD r6, STACK
            LEA r0, data
            AND r1, r1, #0
            ADD r1, r1, #6
            JSR sort
            HALT

data        .FILL #2
            .FILL #3
            .FILL #1
            .FILL #6
            .FILL #5
            .FILL #3

STACK       .FILL xFE00

;void sort(ptr: r0, size: r1) {
;	for (j = size; j > 0; --j) {
;		for (i = 1; i < j; ++i) {
;			if (ptr[i] < ptr[i - 1]) {
;				tmp: t2 = ptr[i];
;				ptr[i] = ptr[i - 1];
;				ptr[i - 1] = ptr[i];
;			}
;		}
;	}
;}

;void sort(int *ptr, int size) {
;	int j, i;
;	register int t0, t1, t2;
;	j = size;
;	goto j_cond;
;j_loop:
;	j -= 1;
;j_cond:
;	if (j <= 0) goto j_end;
;	i = 0;
;i_loop:
;	i += 1;
;	if (i >= j) goto j_loop;
;	t2 = ptr + i;
;	t0 = t2[0];
;	t1 = t2[-1];
;	if (t0 >= t1) goto i_loop;
;	t2[0] = t1;
;	t2[-1] = t0;
;	goto i_loop;
;j_end:
;	return;
;}

; sort(ptr: r0, size: r1) -> void
sort        STR r0, r6, #-1
            STR r1, r6, #-2
            STR r2, r6, #-3
            STR r3, r6, #-4
            
            ST r0, $ptr
            
            ST r1, $j ; j = size
            ADD r0, r1, #0
            BR $j_cond
            
$j_loop     LD r0, $j       ; j -= 1
            ADD r0, r0, #-1 ;
            ST r0, $j       ;
$j_cond     BRnz $j_end     ; if j <= 0: break
            AND r0, r0, #0  ; i = 0
            ST r0, $i       ;
            
$i_loop     LD r0, $i      ; i += 1
            ADD r0, r0, #1 ;
            ST r0, $i      ;
            LD r1, $j      ; if i >= j: break
            NOT r1, r1     ;
            ADD r1, r1, #1 ;
            ADD r1, r0, r1 ;
            BRzp $j_loop   ;
            
            LD r0, $ptr     ; t2 = ptr + i
            LD r1, $i       ;
            ADD r0, r0, r1  ;
            LDR r1, r0, #0  ; t0 = t2[0]
            LDR r2, r0, #-1 ; t1 = t2[-1]
            
            NOT r3, r2      ; if t0 >= t1: continue
            ADD r3, r3, #1  ;
            ADD r3, r3, r1  ;
            BRzp $i_loop    ;
            
            STR r2, r0, #0  ; t2[0] = t1
            STR r1, r0, #-1 ; t2[-1] = t0
            
            BR $i_loop ; continue
            
$j_end      LDR r0, r6, #-1
            LDR r1, r6, #-2
            LDR r2, r6, #-3
            LDR r3, r6, #-4
            RET

$ptr        .FILL #0
$j          .FILL #0
$i          .FILL #0


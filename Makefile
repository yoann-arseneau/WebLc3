.PHONY: printf float

printf: out/printf
	out/printf
float: out/float
	out/float

out/printf: printf.c
	gcc -std=c18 -g printf.c -o out/printf
out/float: float.c
	gcc -std=c18 -g float.c -o out/float


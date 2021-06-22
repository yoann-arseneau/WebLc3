#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int myprintf(char *format, ...);

int main() {
	myprintf("1: plain\n");
	myprintf("2: char %c%c%c%c%c", 'c', 'h', 'a', 'r', '\n');
	myprintf("3: string %s %s %s", "are", "very", "cool\n");
	myprintf("4: %i %d %i\n", 0, 0x7FFF, 0xFFFF8000);
	myprintf("5: %u %u %u\n", 0, 0x7FFF, 0x0000FFFF);
	myprintf("6: ");
}

typedef struct {
	union {
		int _int;
		unsigned int _uint;
		long _long;
		unsigned long _ulong;
		char _char;
		void *_ptr;
	};
	int n;
	int width;
	char specifier;
	bool leftJustify;
	bool forceSign;
	bool spaceSign;
	bool alternate;
	bool prefixZero;
} printf_conf;

static void print_signed(printf_conf *conf);
static void print_unsigned(printf_conf *conf);
static void print_oct(printf_conf *conf);
static void print_hex(printf_conf *conf);
static void print_char(printf_conf *conf);
static void print_cstr(printf_conf *conf);
static void print_ptr(printf_conf *conf);

int myprintf(char *format, ...) {
	va_list vl;
	char c;
	printf_conf conf;
	
	va_start(vl, format);
	while (c = *format++) {
		if (c == '%') {
			memset(&conf, 0, sizeof(printf_conf));
			c = *format++;
			
			if (c == '%') {
				putchar(c);
				continue;
			}
			
			// flags
			while (1) {
				if (c == '-') {
					conf.leftJustify = true;
				}
				else if (c == '+') {
					conf.forceSign = true;
				}
				else if (c == ' ') {
					conf.spaceSign = true;
				}
				else if (c == '#') {
					conf.alternate = true;
				}
				else if (c == '0') {
					conf.prefixZero = true;
				}
				else {
					break;
				}
				c = *format++;
			}
			
			// width
			if (c == '*') {
				conf.width = va_arg(vl, int);
				c = *format++;
			}
			else if (c >= '0' && c <= '9') {
				puts("not implemented: inline width");
				abort();
			}
			else {
				conf.width = 0;
			}
			
			// precision
			if (c == '.') {
				puts("not implemented: precision");
				abort();
			}
			
			// specifier
			conf.specifier = c;
			switch (c) {
			case 'd':
			case 'i':
				conf._int = va_arg(vl, int);
				print_signed(&conf);
				break;
			case 'u':
				conf._int = va_arg(vl, int);
				print_unsigned(&conf);
				break;
			case 'o':
				conf._int = va_arg(vl, int);
				print_oct(&conf);
				break;
			case 'x':
			case 'X':
				conf._int = va_arg(vl, int);
				print_hex(&conf);
				break;
			case 'f':
			case 'F':
			case 'e':
			case 'E':
			case 'g':
			case 'G':
			case 'a':
			case 'A':
				puts("not implemented: float (fFeEgGaA)");
				abort();
			case 'c':
				conf._int = va_arg(vl, int);
				print_char(&conf);
				break;
			case 's':
				conf._ptr = va_arg(vl, char*);
				print_cstr(&conf);
				break;
			case 'p':
				conf._ptr = va_arg(vl, void*);
				print_ptr(&conf);
				break;
			case 'n':
				*(va_arg(vl, int*)) = conf.n;
				break;
			case '\0':
				puts("expecting specifier");
				abort();
			default:
				puts("bad format specifier");
				abort();
			}
		}
		else {
			putchar(c);
			conf.n += 1;
		}
	}
	va_end(vl);
	return conf.n;
}

static void doprintf(printf_conf *conf, char *buffer, int length);

static char HEX_UPPER[] = "0123456789ABCDEF";
static char HEX_LOWER[] = "0123456789abcdef";

static void print_signed(printf_conf *conf) {
	unsigned num;
	bool negative;
	char buffer[6];
	char *cursor = buffer + sizeof(buffer);
	
	// configure
	if (conf->_int < 0) {
		negative = true;
		num = -conf->_int;
	}
	else {
		negative = false;
		num = conf->_int;
	}
	
	// number-part
	do {
		*--cursor = num % 10 + '0';
		num /= 10;
	} while (num != 0);
	
	// sign
	if (conf->forceSign) {
		*--cursor = negative ? '-' : '+';
	}
	else if (conf->spaceSign) {
		*--cursor = ' ';
	}
	else if (negative) {
		*--cursor = '-';
	}
	doprintf(conf, cursor, buffer + sizeof(buffer) - cursor);
}
static void print_unsigned(printf_conf *conf) {
	unsigned num = conf->_uint;
	char buffer[5];
	char *cursor = buffer + sizeof(buffer);
	
	do {
		*--cursor = num % 10 + '0';
		num /= 10;
	} while (num != 0);
	
	doprintf(conf, cursor, buffer + sizeof(buffer) - cursor);
}
static void print_oct(printf_conf *conf) {
	unsigned num = conf->_uint;
	char buffer[6];
	char *cursor = buffer + sizeof(buffer);
	
	do {
		*--cursor = num % 8 + '0';
		num /= 8;
	} while (num != 0);
	
	doprintf(conf, cursor, buffer + sizeof(buffer) - cursor);
}
static void print_hex(printf_conf *conf) {
	char *lookup = conf->specifier == 'X'
		? HEX_UPPER
		: HEX_LOWER;
	unsigned num = conf->_uint;
	char buffer[4];
	char *cursor = buffer + sizeof(buffer);
	
	do {
		*--cursor = lookup[num % 16];
		num /= 16;
	} while (num != 0);
	
	doprintf(conf, cursor, buffer + sizeof(buffer) - cursor);
}
static void print_char(printf_conf *conf) {
	doprintf(conf, &conf->_char, 1);
}
static void print_cstr(printf_conf *conf) {
	char *str = (char*)conf->_ptr;
	doprintf(conf, str, strlen(str));
}
static void print_ptr(printf_conf *conf) {
	unsigned num = conf->_uint;
	char buffer[6] = "0x0000";
	char *cursor = buffer + sizeof(buffer);
	
	do {
		*--cursor = HEX_UPPER[num % 16];
		num /= 16;
	} while (num != 0);
	
	doprintf(conf, cursor, buffer + sizeof(buffer) - cursor);
}

static void doprintf(printf_conf *conf, char *str, int n) {
	int i;
	if (n < conf->width && !conf->leftJustify ) {
		int diff = conf->width - n;
		char c = conf->prefixZero ? '0' : ' ';
		while (diff--) {
			putchar(c);
			conf->n += 1;
		}
	}
	for (i = 0; i < n; ++i) {
		putchar(*str++);
		conf->n += 1;
	}
	if (n < conf->width && conf->leftJustify) {
		int diff = conf->width - n;
		while (diff--) {
			putchar(' ');
			conf->n += 1;
		}
	}
}

/*
.at r0
call _printf, &fmt, #5, *six

push fmt, [five] ; call
jsr _printf      ; -

LD r0, five     ; push
STR r0, r6, #-1 ; -
LEA r0, fmt     ; -
STR r0, r6, #-2 ; -
ADD r6, r6, #2  ; -
jsr _printf

five .fill #5
fmt .stringz "test %d\n"


literal => and at, at, #0
           add at, at, #0
[label] => ldr at, label
label   => lea at, label
*/


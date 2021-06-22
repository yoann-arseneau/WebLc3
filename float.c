/*
            b w m
bool        1 1 b
char        1 1 c
short       2 1 s
int         2 1 i
long        4 2 l
long long   8 4 L

            b w m ex fr ty
float       2 1 f 5  10 ss
double      4 2 d 8  23 sl
long double 8 4 D 11 52 sL

b : bytes
w : words
m : mnemonic
ex: exponent
fr: fraction
ty: types
*/

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>

typedef struct {
	uint16_t s : 1, e : 5, f : 10;
} f16;

static uint16_t F16_ZERO = 0;
static uint16_t F16_ONE = 0x3C00;
static uint16_t F16_TWO = 0x4000;
static uint16_t F16_THREE = 0x4200;

uint16_t clz(uint16_t);
uint16_t clzl(uint32_t);
uint16_t clzll(uint64_t);
uint16_t mulf(uint16_t x, uint16_t y);

int main() {
	printf("%i %i\n", 0, clz(0));
	printf("%i %i\n", 1 << 0, clz(1 << 0));
	printf("%i %i\n", 1 << 1, clz(1 << 1));
	printf("%i %i\n", 1 << 2, clz(1 << 2));
	printf("%i %i\n", 1 << 3, clz(1 << 3));
	printf("%i %i\n", 1 << 4, clz(1 << 4));
	printf("%i %i\n", 1 << 5, clz(1 << 5));
	printf("%i %i\n", 1 << 6, clz(1 << 6));
	printf("%i %i\n", 1 << 7, clz(1 << 7));
	printf("%i %i\n", 1 << 8, clz(1 << 8));
	printf("%i %i\n", 1 << 9, clz(1 << 9));
	printf("%i %i\n", 1 << 10, clz(1 << 10));
	printf("%i %i\n", 1 << 11, clz(1 << 11));
	printf("%i %i\n", 1 << 12, clz(1 << 12));
	printf("%i %i\n", 1 << 13, clz(1 << 13));
	printf("%i %i\n", 1 << 14, clz(1 << 14));
	printf("%i %i\n", 1 << 15, clz(1 << 15));
}

uint16_t CLZ_3BIT_LOOKUP[] = { 4, 3, 2, 2, 1, 1, 1, 1, };
uint16_t clz(uint16_t value) {
    short offset = 0;
    if (value & 0xFF00) {
        value >>= 8;
    }
    else {
        offset += 8;
    }
    if (value & 0x00F0) {
        value >>= 4;
    }
    else {
        offset += 4;
    }
    if (value < 8) {
        offset += CLZ_3BIT_LOOKUP[value];
    }
    return offset;
}
uint16_t clzl(uint32_t value) {
    if (value >> 16) {
        return clz((uint16_t)(value >> 8));
    }
    else {
        return 16 + clz((uint16_t)value);
    }
}
uint16_t clzll(uint64_t value) {
	if (value >> 48) {
		return clz((uint16_t)(value >> 48));
	}
	else if (value >> 32) {
		return 16 + clz((uint16_t)(value >> 32));
	}
	else if (value >> 16) {
		return 32 + clz((uint16_t)(value >> 16));
	}
	else {
		return 48 + clz((uint16_t)value);
	}
}

// 1 5 10
// (1023/1024)*2^+15  65504
// (   1/1024)*2^-15  2.98023223876953125e-8

uint16_t mulf(uint16_t x, uint16_t y) {
    // calculate sign
    uint16_t s = (x ^ y) & 0x8000;

    // get exponents
    uint16_t ex = ((x >> 10) & 0x1F) - 15;
    uint16_t ey = ((y >> 10) & 0x1F) - 15;
    if (ex == 15 || ey == 15) {
        puts("not implemented: NaN and inf");
        abort();
    }

    // get fractions
    uint16_t mx = x & 0x3FF;
    uint16_t my = y & 0x3FF;

	// NaN and Infinity handling
	if (ex == 15 || ey == 15) {
		if (ex == 15 && mx) {
			return x;
		}
		else if (ey == 15 && my) {
			return y;
		}
		else {
			return s + 0x7C00;
		}
	}

    // adjust into mantissas
    if (ex > -15) mx += 0x0400;
    if (ey > -15) my += 0x0400;

	if (mx == 0 || my == 0) {
		return s + 0;
	}

    // calculate exponent
    int16_t e = ex + ey;
    // calculate mantissa
    uint32_t m = (uint32_t)mx * (uint32_t)my;

    // normalize e, m
	uint16_t lz = clzl(m);
    int16_t offset = 21 - lz;
    e += offset;
	// overflow and underflow handling
    if (e >= 15) {
		// overflow
        return s + 0x7C00;
    }
	else if (e < -15) {
		puts("subnormal/zero not implemented");
		abort();
	}

	if (offset > 0) {
		m <<= offset;
	}
	else {
		m >>= -offset;
	}

    return s + e + m;
}


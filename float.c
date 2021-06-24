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

seee eeff ffff ffff

-1^s * 1+f/1024 * 2^(e-15)

e is 0       -> subnormal
e in [1..30] -> normal
e in 31      -> +inf, -inf, NaN

b : bytes
w : words
m : mnemonic
ex: exponent
fr: fraction
ty: types
*/

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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

void f2str(uint16_t value, char *buffer) {
	bool s = (value & 0x8000) != 0;
	signed e = ((value >> 10) & 0x1F) - 15;
	unsigned f = value & 0x3FF;
	if (e == 16) {
		if (f) {
			strcpy(buffer, "nan");
		}
		else if (s) {
			strcpy(buffer, "-inf");
		}
		else {
			strcpy(buffer, "inf");
		}
	}
	else {
		buffer[0] = 0;
		if (s) {
			strcat(buffer, "-");
		}
		if (e == -15 && !f) {
			strcat(buffer, "0");
		}
		else {
			if (e > -15) {
				if (f) {
					sprintf(buffer + strlen(buffer), "(1+%u/1024) * 2^%i", f, e);
				}
				else {
					sprintf(buffer + strlen(buffer), "2^%i", e);
				}
			}
			else if (f) {
				sprintf(buffer + strlen(buffer), "%u/1024 * 2^%i", f, e);
			}
			else {
				strcat(buffer, "0");
			}
		}
	}
}
void putf(uint16_t value) {
	char buffer[32];
	f2str(value, buffer);
	puts(buffer);
}

int main() {
	putf(0x7C00);
	putf(0xFC00);
	putf(0x7C01);
	putf(0);
	putf(0x0001);
	putf(F16_ONE);
	putf(F16_TWO + 0x8000);
	putf(F16_THREE);
	return 0;
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

bool isnegf(uint16_t);

uint16_t absf(uint16_t);
uint16_t negf(uint16_t);
uint16_t invf(uint16_t);

uint16_t addf(uint16_t, uint16_t);
uint16_t subf(uint16_t, uint16_t);
uint16_t mulf(uint16_t, uint16_t);
uint16_t divf(uint16_t, uint16_t);

bool isnegf(uint16_t x) {
	return x & 0x8000;
}

uint16_t absf(uint16_t x) {
	return x & 0x7FFF;
}
uint16_t negf(uint16_t x) {
	return x ^ 0x8000;
}

uint16_t addf(uint16_t x, uint16_t y) {
	if (isnegf(x)) {
		if (isnegf(y)) {
			return negf(addf(negf(x), negf(y)));
		}
		else {
			return subf(y, negf(x));
		}
	}
	else if (isnegf(y)) {
		return subf(x, negf(y));
	}

	uint16_t ex = ((x >> 10) & 0x1F) - 15;
	uint16_t ey = ((x >> 10) & 0x1F) - 15;

	uint16_t fx = x & 0x3FF;
	uint16_t fy = y & 0x3FF;

	puts("not implemented: addf");
	abort();
}
uint16_t subf(uint16_t x, uint16_t y) {
	puts("not implemented: subf");
	abort();
}

// 1 5 10

uint16_t mulf(uint16_t x, uint16_t y) {
    // calculate sign
    uint16_t s = (x ^ y) & 0x8000;

    // get exponents
    uint16_t ex = ((x >> 10) & 0x1F) - 15;
    uint16_t ey = ((y >> 10) & 0x1F) - 15;

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
			// TODO How is 0 handled??
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


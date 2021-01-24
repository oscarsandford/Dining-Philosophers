out=wasm/dp.html
CC=emcc
EMCC_FLAGS=-s PTHREAD_POOL_SIZE=7 -s WASM=0

all: $(out)

$(out): dp_asm.c
	$(CC) dp_asm.c -pthread $(EMCC_FLAGS) -o $(out)

clean:
	cd wasm && rm *
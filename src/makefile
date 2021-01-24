out=dining_philosopher
CC=gcc
CFLAGS=-lpthread -lrt

dining_philosopher : dp.o waiter.o
	$(CC) -o $(out) dp.o waiter.o $(CFLAGS)

dp.o: dp.c waiter.h
	$(CC) -c dp.c

waiter.o: waiter.c waiter.h
	$(CC) -c waiter.c

clean:
	rm *.o
	rm $(out)
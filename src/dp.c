#include <stdio.h>
#include <unistd.h>
#include <pthread.h>
#include <ctype.h>
#include <string.h>
#include "waiter.h"

// Philosopher process:
// 1. Initialize as thinking.
// 2. Wait to pick up chopsticks.
// 3. Eat, drop chopsticks.
// 4. Repeat.
void *philosopher(void *i) {
	while (1) {
		int self = *(int *)i;
		printf("Philosopher %d: \033[94m thinking \033[0m for %d seconds.\n",self,THINK_TIME);
		sleep(THINK_TIME);
		pickup(self);
		printf("Philosopher %d: \033[92m eating \033[0m for %d seconds.\n",self,EAT_TIME);
		sleep(EAT_TIME);
		drop(self);
	}
}

int main() {
	int i, pos[N];
	pthread_t dp_threads[N];
	pthread_attr_t attr;

	initialize();
	pthread_attr_init(&attr);

	// Create philosopher threads
	for (i = 0; i < N; i++) {
		pos[i] = i;
		pthread_create(&dp_threads[i], NULL, philosopher, &pos[i]);
	}
	for (i = 0; i < N; i++) {
		pthread_join(dp_threads[i], NULL);
	}
	return 0;
}	

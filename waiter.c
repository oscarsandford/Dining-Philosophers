#include <stdio.h>
#include <unistd.h>
#include <pthread.h>
#include <ctype.h>
#include <semaphore.h>
#include "waiter.h"

// Waiter semaphores for monitor implementation
sem_t waiter_mutex;
sem_t waiter_next;
// Philosopher states
int dp_state[N];
// Philosopher semaphores
typedef struct {
	sem_t sem;
	int cond_count;
} condition;
condition x[N];
// Number of philosophers waiting on next semaphore
int next_count = 0;


// Monitor wait, "queues" a philosopher for waiter
void wait(int i) {
	x[i].cond_count++;
	
	// If someone waiting, post to the next, else unblock waiter
	if (next_count > 0) sem_post(&waiter_next);
	else sem_post(&waiter_mutex);

	sem_wait(&x[i].sem);
	x[i].cond_count--;
}

// Monitor signal, "dequeues" a philosopher for waiter
void signal(int i) {
	if (x[i].cond_count > 0) {
		next_count++;
		sem_post(&x[i].sem);
		sem_wait(&waiter_next);
		next_count--;
	}
}

void test(int i) {
	// Signals a philosopher to eat if they are hungry and chopsticks are available.
	if (dp_state[i] == HUNGRY && dp_state[LEFT] != EATING && dp_state[RIGHT] != EATING) {
		dp_state[i] = EATING;
		signal(i);
	}
}

void pickup(int i) {
	// Wait on waiter to give the ok. Now hungry.
	sem_wait(&waiter_mutex);
	dp_state[i] = HUNGRY;
	
	// Try to start eating, otherwise will wait.
	test(i);
	if (dp_state[i] != EATING) wait(i);

	// If someone waiting, post to the next, else unblock waiter.
	if (next_count > 0) sem_post(&waiter_next);
	else sem_post(&waiter_mutex);
}

void drop(int i) {
	// Wait on waiter to give the ok. Now thinking.
	sem_wait(&waiter_mutex);
	dp_state[i] = THINKING;
	
	// Will end up signaling left and right philosophers may eat.
	test(LEFT);
	test(RIGHT);
	
	// If someone waiting, post to the next, else unblock waiter.
	if (next_count > 0) sem_post(&waiter_next);
	else sem_post(&waiter_mutex);
}

void initialize() {
	int i;
	sem_init(&waiter_mutex, 0, 1);
	sem_init(&waiter_next, 0, 0);

	// Philosophers start in thinking state.
	for (i = 0; i < N; i++) {
		dp_state[i] = THINKING;
		sem_init(&x[i].sem,0,0);
		x[i].cond_count = 0;
	}
}

#define N 7
#define HUNGRY 0
#define EATING 1
#define THINKING 2

#define EAT_TIME 5
#define THINK_TIME 5

#define LEFT (i+N-1)%N
#define RIGHT (i+1)%N

void initialize();
void test(int i);
void pickup(int i);
void drop(int i);

// import PQueue from 'p-queue';
const PQueue = require('p-queue').default;

// let PQueue;
// import('p-queue').then(module => {
//     PQueue = module.default;
//     // Initialize PQueue and use it here, or make sure it's initialized where it's going to be used
// });

export const OPENAI_TTS_QUEUE = new PQueue({
    interval: 60000,
    intervalCap: 100,
    concurrency: 100,
});

export function addBackgroundTask<T>(taskFunction: () => Promise<T>): Promise<T> {
    // Explicitly type the return of OPENAI_TTS_QUEUE.add to Promise<T>
    return OPENAI_TTS_QUEUE.add(taskFunction, {
        priority: 10,  // Assuming lower number means higher priority
    }) as Promise<T>; // Type assertion here if necessary
}

export function addPriorityTask(taskFunction, isBackgroundTask = false) {
    return OPENAI_TTS_QUEUE.add(taskFunction, {
        priority: 0, // Lower number means higher priority
    });
}

//Logging
// Event when a task is added
OPENAI_TTS_QUEUE.on('add', () => {
    console.log(`Task added. Queue size: ${OPENAI_TTS_QUEUE.size}. Pending tasks: ${OPENAI_TTS_QUEUE.pending}.`);
});

// Event when a task completes and the next task starts
OPENAI_TTS_QUEUE.on('next', () => {
    console.log(`Task completed. Queue size: ${OPENAI_TTS_QUEUE.size}. Pending tasks: ${OPENAI_TTS_QUEUE.pending}.`);
});
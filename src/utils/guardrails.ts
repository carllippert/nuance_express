type MiddlewareFunction<T> = (data: T, context: any, next: () => Promise<T>) => Promise<T>;

async function runMiddleware<T>(data: T, middlewares: MiddlewareFunction<T>[], context: any = {}): Promise<T> {
    // Internal function to execute the middleware stack
    async function execute(index: number, currentData: T): Promise<T> {
        if (index < middlewares.length) {
            const middleware = middlewares[index];
            return middleware(currentData, context, () => execute(index + 1, currentData));
        } else {
            return currentData;
        }
    }

    // Start the execution with the first middleware
    return execute(0, data);
}

// Example middleware functions
const checkNonEmpty: MiddlewareFunction<string> = async (data, context, next) => {
    if (!data) {
        throw new Error('Data is empty');
    }
    return next();
};

const checkLength: MiddlewareFunction<string> = async (data, context, next) => {
    if (data.length < 5) {
        throw new Error('Data is too short');
    }
    return next();
};

const logData: MiddlewareFunction<string> = async (data, context, next) => {
    console.log('Current data:', data);
    return next();
};

const trimData: MiddlewareFunction<string> = async (data, context, next) => {
    const trimmedData = data.trim();
    context.modified = true;
    return next().then(() => trimmedData);
};

// Example usage
(async () => {
    const data = "  Hello, World!  ";
    const middlewares = [checkNonEmpty, checkLength, logData, trimData];

    try {
        const cleanedData = await runMiddleware(data, middlewares);
        console.log('Cleaned data:', cleanedData);
    } catch (error) {
        console.error('Error:', error.message);
    }
})();

import axios from 'axios';
import axiosRetry from 'axios-retry';

export const openai_client = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// Apply retry configuration to only this instance
axiosRetry(openai_client, {
    retries: 2, // Number of retry attempts
    retryCondition: (error) => {
        // Define when to retry. For example, retry on network errors or 5xx errors.
        return error.response.status >= 500 || axiosRetry.isNetworkOrIdempotentRequestError(error);
    },
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff delay between retries
    onRetry(retryCount, error, requestConfig) {
        // requestConfig.
    },
});
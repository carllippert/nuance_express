import axios, { AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

export const openai_client = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    __retryCount?: number;
}

// Apply retry configuration to only this instance
axiosRetry(openai_client, {
    retries: 2, // Number of retry attempts
    retryCondition: (error) => {
        // Define when to retry. For example, retry on network errors or 5xx errors.
        return error.response.status >= 500 || axiosRetry.isNetworkOrIdempotentRequestError(error);
    },
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff delay between retries
    onRetry(retryCount, error, requestConfig) {
        // onRetry: (retryCount, error, requestConfig) => {
        // Attach or update the retry count on the request configuration
        (requestConfig as CustomAxiosRequestConfig).__retryCount = retryCount;
        // }
        console.error('Retry Error number:', error.response.status);
        console.error('Error response:', error.response.data);
        console.error(`Retry attempt #${retryCount}`);
    },
});
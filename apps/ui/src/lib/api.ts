import axios, { AxiosInstance } from 'axios';

const API_URL = '/api/proxy';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add request interceptor to track start time for RUM.
        this.client.interceptors.request.use(
            (config) => {
                if (typeof window !== 'undefined') {
                    (config as any).metadata = { startTime: Date.now() };
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            },
        );

        // Add response interceptor to handle token refresh and track performance
        this.client.interceptors.response.use(
            (response) => {
                // Track API performance
                if (typeof window !== 'undefined') {
                    try {
                        // Lazy import to avoid SSR issues
                        const rum = (window as any).__rum;
                        if (rum) {
                            const duration = Date.now() - ((response.config as any).metadata?.startTime || Date.now());
                            rum.trackPerformance('API Request', duration, {
                                method: response.config.method,
                                url: response.config.url,
                                status: response.status,
                            });
                        }
                    } catch (e) {
                        // Silently fail if RUM is not available
                    }
                }
                return response;
            },
            (error) => {
                // Track API errors
                if (typeof window !== 'undefined') {
                    try {
                        // Lazy import to avoid SSR issues
                        const rum = (window as any).__rum;
                        if (rum) {
                            rum.trackError(
                                new Error(`API Error: ${error.response?.status || 'Network Error'}`),
                                {
                                    method: error.config?.method,
                                    url: error.config?.url,
                                    status: error.response?.status,
                                    message: error.response?.data?.message,
                                }
                            );
                        }
                    } catch (e) {
                        // Silently fail if RUM is not available
                    }
                }
                return Promise.reject(error);
            },
        );
    }

    get instance() {
        return this.client;
    }
}

export const apiClient = new ApiClient().instance;

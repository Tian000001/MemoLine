import axios from 'axios';

export const http = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export * as events from './events';
export * as analysis from './analysis';

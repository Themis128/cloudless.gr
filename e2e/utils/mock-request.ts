import { NextRequest } from 'next/server';

export function mockRequest({ url, headers = {} }: { url: string; headers?: Record<string, string> }) {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}
import { getValidAccessToken } from './supabase';

export interface ApiOptions extends RequestInit {
  timeoutMs?: number;
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: any;
}

class ApiClient {
  private getBaseUrl(): string {
    // Normally the frontend and Express API are served from the same origin.
    // A separate backend origin is supported for hosts that deploy Vite/SPA
    // separately from the Node/Express API. Never hard-code a deployment URL.
    const raw = (import.meta as any).env?.VITE_API_BASE_URL;
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (
      trimmed === '' ||
      trimmed === 'undefined' ||
      trimmed === 'null' ||
      trimmed === '/' ||
      trimmed === '/api' ||
      trimmed === '/api/'
    ) {
      return '';
    }
    // Strip trailing slashes and trailing /api to avoid duplicated /api prefixes
    let cleaned = trimmed.replace(/\/+$/, '');
    if (cleaned.endsWith('/api')) {
      cleaned = cleaned.slice(0, -4);
    }
    return cleaned;
  }

  async request(endpoint: string, options: ApiOptions = {}): Promise<Response> {
    const { headers: userHeaders, ...fetchOpts } = options;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const base = this.getBaseUrl();
    const url = base ? `${base}${path}` : path;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(userHeaders as Record<string, string>),
    };

    if (fetchOpts.body && typeof fetchOpts.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const token = await getValidAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[ApiClient] Unable to obtain Supabase access token:', err);
    }

    const isHeavyEndpoint = /\/(generate-plan|generate|edit|audit|compile|deploy|remediate|benchmark|health|overview)/i.test(path);
    const defaultTimeout = isHeavyEndpoint ? 180000 : 60000;
    const timeoutMs = options.timeoutMs ?? defaultTimeout;

    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        controller.abort(new DOMException(`Request to ${path} timed out after ${timeoutMs}ms`, 'TimeoutError'));
      } catch {
        controller.abort();
      }
    }, timeoutMs);

    const onExternalAbort = () => {
      try {
        controller.abort(options.signal?.reason);
      } catch {
        controller.abort();
      }
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onExternalAbort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        credentials: fetchOpts.credentials || 'same-origin',
        ...fetchOpts,
        headers,
        signal: controller.signal,
      });

      // API boundary guard. Every /api response must be JSON. A missing/mismatched
      // route can otherwise fall through to a SPA host and return index.html, which
      // causes every existing caller that does response.json() to fail with the
      // misleading `Unexpected token '<'` error. Normalize such responses into a
      // real JSON Response while preserving the original HTTP status.
      if (path === '/api' || path.startsWith('/api/')) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const looksJson = contentType.includes('application/json') || contentType.includes('+json');

        if (!looksJson) {
          let bodyPreview = '';
          try {
            bodyPreview = (await response.clone().text()).trim();
          } catch {
            // Ignore clone/read failures; the normalized error below is sufficient.
          }

          const isHtml = contentType.includes('text/html') ||
            contentType.includes('application/xhtml+xml') ||
            /^<!doctype\s+html/i.test(bodyPreview) ||
            /^<html[\s>]/i.test(bodyPreview);

          const code = isHtml ? 'API_HTML_RESPONSE' : 'API_NON_JSON_RESPONSE';
          const method = (fetchOpts.method || 'GET').toUpperCase();
          const safeBodySample = bodyPreview.slice(0, 120).replace(/\s+/g, ' ');
          const message = isHtml
            ? `API endpoint ${method} ${path} returned HTML instead of JSON (HTTP ${response.status}, Content-Type: ${contentType || 'unknown'}). Expected application/json. The request likely reached an SPA/static fallback instead of the Express API.`
            : `API endpoint ${method} ${path} returned a non-JSON response (HTTP ${response.status}, Content-Type: ${contentType || 'unknown'}).`;

          console.error(`[${code}] ${message}`, { url, status: response.status, contentType, preview: safeBodySample });

          // A SPA fallback can return HTTP 200 with index.html. Never expose that
          // as a successful API response; convert it to a server-side failure status.
          const normalizedStatus = response.ok ? 502 : response.status;

          return new Response(JSON.stringify({
            success: false,
            code,
            error: {
              code,
              message,
              url: path,
              status: response.status,
              contentType: contentType || 'unknown',
              bodyPreview: safeBodySample,
            },
            originalStatus: response.status,
          }), {
            status: normalizedStatus,
            statusText: normalizedStatus === response.status ? response.statusText : 'Bad Gateway',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate, private',
              'X-Content-Type-Options': 'nosniff',
              'X-API-Normalized-Error': 'true',
              'X-API-Original-Status': String(response.status),
            },
          });
        }
      }

      return response;
    } catch (err: any) {
      if (timedOut) {
        const timeoutError = new Error(`Request to ${path} timed out after ${Math.round(timeoutMs / 1000)}s. Please retry.`);
        (timeoutError as any).code = 'TIMEOUT';
        (timeoutError as any).status = 408;
        throw timeoutError;
      }
      if (err?.name === 'AbortError' && !options.signal?.aborted) {
        const abortError = new Error(`Request to ${path} was interrupted or timed out. Please retry.`);
        (abortError as any).code = 'ABORT_ERROR';
        throw abortError;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (options.signal && onExternalAbort) {
        try {
          options.signal.removeEventListener('abort', onExternalAbort);
        } catch {
          // Ignore listener removal failure
        }
      }
    }
  }

  async fetchJson<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const response = await this.request(endpoint, options);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const err: any = new Error(`The API endpoint (${endpoint}) returned HTML instead of JSON (HTTP ${response.status}).`);
      err.code = 'API_HTML_RESPONSE';
      err.status = response.status;
      throw err;
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      const err: any = new Error(`Failed to parse JSON response from ${endpoint} (HTTP ${response.status}).`);
      err.code = 'INVALID_JSON_RESPONSE';
      err.status = response.status;
      throw err;
    }

    if (!response.ok) {
      const msg =
        (typeof payload?.error === 'object' ? payload?.error?.message : payload?.error) ||
        payload?.message ||
        `API request to ${endpoint} failed with status ${response.status}`;
      const err: any = new Error(msg);
      err.status = response.status;
      err.code = payload?.code || (typeof payload?.error === 'object' ? payload?.error?.code : 'API_ERROR');
      err.payload = payload;
      throw err;
    }

    return payload as T;
  }

  get(endpoint: string, options?: ApiOptions) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint: string, body?: any, options?: ApiOptions) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put(endpoint: string, body?: any, options?: ApiOptions) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete(endpoint: string, options?: ApiOptions) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export const authedFetch = (url: string, options?: RequestInit) => apiClient.request(url, options);

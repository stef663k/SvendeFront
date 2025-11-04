
export const API_BASE = (import.meta as any).env?.PUBLIC_API_BASE || 'https://agora-api-unique.azurewebsites.net';

function getCookie(name: string): string | null {
    try {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
    } catch {}
    return null;
}

function setCookie(name: string, value: string, days: number) {
    try {
        if (typeof document === 'undefined') return;
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        const expires = `expires=${date.toUTCString()}`;
        const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Lax${secure}`;
    } catch {}
}

function deleteCookie(name: string) {
    try {
        if (typeof document === 'undefined') return;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    } catch {}
}

let accessTokenMemory: string | null = null;
export function setAccessToken(token: string | null) {
    accessTokenMemory = token;
    try {
        if (token) setCookie('auth_token', token, 7);
        else deleteCookie('auth_token');
    } catch {}
}

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
    async function doFetch(): Promise<Response> {
        const cookieToken = getCookie('auth_token');
        const token = accessTokenMemory ?? cookieToken;
        const headers = new Headers(init.headers || {} as any);
        if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
    }

    const res = await doFetch();
    if (path === '/api/Auth/session') {
        if (res.ok) {
            try {
                const data = await res.clone().json();
                if (data?.token) setAccessToken(data.token);
            } catch {}
        }
        return res;
    }
    if (res.status !== 401) return res;

    const refreshRes = await fetch(`${API_BASE}/api/Auth/session`, { credentials: 'include' });
    if (refreshRes.ok) {
        try {
            const data = await refreshRes.json();
            if (data?.token) setAccessToken(data.token);
        } catch {}
        return doFetch();
    }
    return res;
}

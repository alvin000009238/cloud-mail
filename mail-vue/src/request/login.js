import http from '@/axios/index.js';

function currentOrigin() {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }

    return '';
}

export function login(email, password) {
    return http.post('/login', {email: email, password: password})
}

export function logout() {
    return http.delete('/logout')
}

export function register(form) {
    return http.post('/register', form)
}

export function oauthAuthorize(provider) {
    return http.get(`/oauth/${provider}/authorize`, {
        params: { redirect_origin: currentOrigin() }
    })
}

export function oauthCallback(provider, payload) {
    return http.post(`/oauth/${provider}/callback`, payload)
}
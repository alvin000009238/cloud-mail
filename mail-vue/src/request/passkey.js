import http from '@/axios/index.js';

export function passkeyRegisterOptions() {
    return http.post('/passkey/register/options')
}

export function passkeyRegisterVerify(credential, name) {
    return http.post('/passkey/register/verify', { credential, name })
}

export function passkeyLoginOptions() {
    return http.post('/passkey/login/options')
}

export function passkeyLoginVerify(credential) {
    return http.post('/passkey/login/verify', { credential })
}

export function passkeyList() {
    return http.get('/passkey/list')
}

export function passkeyDelete(id) {
    return http.delete(`/passkey/delete/${id}`)
}

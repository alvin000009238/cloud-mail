import orm from '../entity/orm';
import userPasskey from '../entity/user-passkey';
import { and, eq } from 'drizzle-orm';
import BizError from '../error/biz-error';
import KvConst from '../const/kv-const';
import loginService from './login-service';
import userService from './user-service';
import { isDel, userConst } from '../const/entity-const';
import { t } from '../i18n/i18n';

const CHALLENGE_TTL = 60 * 5;

const base64urlEncode = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const base64urlDecode = (str) => {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

function cborDecodeSimple(buf) {
    let offset = 0;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    function read() {
        const initial = buf[offset++];
        const major = initial >> 5;
        const additional = initial & 0x1f;

        let value = additional;
        if (additional === 24) {
            value = buf[offset++];
        } else if (additional === 25) {
            value = view.getUint16(offset);
            offset += 2;
        } else if (additional === 26) {
            value = view.getUint32(offset);
            offset += 4;
        }

        if (major === 0) return value;
        if (major === 1) return -1 - value;
        if (major === 2) {
            const data = buf.slice(offset, offset + value);
            offset += value;
            return data;
        }
        if (major === 3) {
            const strBytes = buf.slice(offset, offset + value);
            offset += value;
            return new TextDecoder().decode(strBytes);
        }
        if (major === 4) {
            const arr = [];
            for (let i = 0; i < value; i++) arr.push(read());
            return arr;
        }
        if (major === 5) {
            const obj = {};
            for (let i = 0; i < value; i++) {
                const key = read();
                obj[key] = read();
            }
            return obj;
        }
        if (major === 7) {
            if (additional === 20) return false;
            if (additional === 21) return true;
            if (additional === 22) return null;
        }

        return null;
    }

    return read();
}

function parseAuthenticatorData(authData) {
    const rpIdHash = authData.slice(0, 32);
    const flags = authData[32];
    const signCountBuf = authData.slice(33, 37);
    const signCount = new DataView(signCountBuf.buffer, signCountBuf.byteOffset, 4).getUint32(0);

    const result = { rpIdHash, flags, signCount };

    if (flags & 0x40) {
        const aaguid = authData.slice(37, 53);
        const credIdLen = new DataView(authData.buffer, authData.byteOffset + 53, 2).getUint16(0);
        const credentialId = authData.slice(55, 55 + credIdLen);
        const publicKeyBytes = authData.slice(55 + credIdLen);
        const publicKeyCose = cborDecodeSimple(publicKeyBytes);

        result.aaguid = aaguid;
        result.credentialId = credentialId;
        result.publicKeyCose = publicKeyCose;
    }

    return result;
}

async function coseKeyToCryptoKey(coseKey) {
    const kty = coseKey[1];
    const alg = coseKey[3];

    if (kty === 2 && alg === -7) {
        const x = coseKey[-2];
        const y = coseKey[-3];
        const publicKeyData = new Uint8Array(65);
        publicKeyData[0] = 0x04;
        publicKeyData.set(x, 1);
        publicKeyData.set(y, 33);

        return await crypto.subtle.importKey(
            'raw',
            publicKeyData,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify']
        );
    }

    if (kty === 3 && (alg === -257 || alg === -37)) {
        const n = coseKey[-1];
        const e = coseKey[-2];
        const nB64 = base64urlEncode(n);
        const eB64 = base64urlEncode(e);
        const jwk = { kty: 'RSA', n: nB64, e: eB64, alg: 'RS256' };

        return await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            true,
            ['verify']
        );
    }

    throw new BizError(t('passkeyUnsupportedAlg'));
}

function derToRaw(derSig) {
    const buf = new Uint8Array(derSig);
    if (buf[0] !== 0x30) return buf;

    let offset = 2;
    const rLen = buf[offset + 1];
    let r = buf.slice(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    const sLen = buf[offset + 1];
    let s = buf.slice(offset + 2, offset + 2 + sLen);

    if (r.length === 33 && r[0] === 0) r = r.slice(1);
    if (s.length === 33 && s[0] === 0) s = s.slice(1);

    const rawR = new Uint8Array(32);
    const rawS = new Uint8Array(32);
    rawR.set(r, 32 - r.length);
    rawS.set(s, 32 - s.length);

    const raw = new Uint8Array(64);
    raw.set(rawR, 0);
    raw.set(rawS, 32);
    return raw;
}

const passkeyService = {

    async generateRegistrationOptions(c, userId, email) {
        const rpId = new URL(c.req.url).hostname;
        const rpName = 'Cloud Mail';

        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const challengeB64 = base64urlEncode(challenge);

        const existingKeys = await this.listByUserId(c, userId);
        const excludeCredentials = existingKeys.map(key => ({
            type: 'public-key',
            id: key.credentialId
        }));

        await c.env.kv.put(
            KvConst.PASSKEY_CHALLENGE + challengeB64,
            JSON.stringify({ userId, type: 'register' }),
            { expirationTtl: CHALLENGE_TTL }
        );

        return {
            rp: { name: rpName, id: rpId },
            user: {
                id: base64urlEncode(new TextEncoder().encode(String(userId))),
                name: email,
                displayName: email
            },
            challenge: challengeB64,
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            timeout: 300000,
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            },
            attestation: 'none',
            excludeCredentials
        };
    },

    async verifyRegistration(c, userId, credential, name) {
        const { id, response: credResponse } = credential;

        if (!id || !credResponse?.clientDataJSON || !credResponse?.attestationObject) {
            throw new BizError(t('passkeyInvalidCredential'));
        }

        const clientDataBytes = base64urlDecode(credResponse.clientDataJSON);
        const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));

        if (clientData.type !== 'webauthn.create') {
            throw new BizError(t('passkeyInvalidCredential'));
        }

        const challengeData = await c.env.kv.get(KvConst.PASSKEY_CHALLENGE + clientData.challenge, { type: 'json' });
        await c.env.kv.delete(KvConst.PASSKEY_CHALLENGE + clientData.challenge);

        if (!challengeData || challengeData.userId !== userId || challengeData.type !== 'register') {
            throw new BizError(t('passkeyChallengeInvalid'));
        }

        const rpId = new URL(c.req.url).hostname;
        const expectedOrigin = new URL(c.req.url).origin;

        if (clientData.origin !== expectedOrigin) {
            const referer = c.req.header('referer') || c.req.header('origin');
            if (referer) {
                const refOrigin = new URL(referer).origin;
                if (clientData.origin !== refOrigin) {
                    throw new BizError(t('passkeyOriginMismatch'));
                }
            } else {
                throw new BizError(t('passkeyOriginMismatch'));
            }
        }

        const attestationBytes = base64urlDecode(credResponse.attestationObject);
        const attestation = cborDecodeSimple(attestationBytes);
        const authData = new Uint8Array(attestation.authData.buffer || attestation.authData);
        const parsed = parseAuthenticatorData(authData);

        const rpIdHashExpected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));

        let rpIdMatch = true;
        for (let i = 0; i < 32; i++) {
            if (parsed.rpIdHash[i] !== rpIdHashExpected[i]) {
                rpIdMatch = false;
                break;
            }
        }

        if (!rpIdMatch) {
            throw new BizError(t('passkeyRpIdMismatch'));
        }

        if (!(parsed.flags & 0x01)) {
            throw new BizError(t('passkeyUserNotPresent'));
        }

        if (!parsed.publicKeyCose) {
            throw new BizError(t('passkeyInvalidCredential'));
        }

        const cryptoKey = await coseKeyToCryptoKey(parsed.publicKeyCose);
        const exportedKey = await crypto.subtle.exportKey('raw', cryptoKey);
        const publicKeyB64 = base64urlEncode(exportedKey);

        const alg = parsed.publicKeyCose[3];

        const existing = await orm(c)
            .select()
            .from(userPasskey)
            .where(eq(userPasskey.credentialId, id))
            .get();

        if (existing) {
            throw new BizError(t('passkeyAlreadyRegistered'));
        }

        const inserted = await orm(c)
            .insert(userPasskey)
            .values({
                userId,
                credentialId: id,
                publicKey: JSON.stringify({ key: publicKeyB64, alg }),
                name: name || 'Passkey',
                signCount: parsed.signCount
            })
            .returning()
            .get();

        return { id: inserted.id, name: inserted.name, createTime: inserted.createTime };
    },

    async generateAuthenticationOptions(c) {
        const rpId = new URL(c.req.url).hostname;

        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const challengeB64 = base64urlEncode(challenge);

        await c.env.kv.put(
            KvConst.PASSKEY_CHALLENGE + challengeB64,
            JSON.stringify({ type: 'login' }),
            { expirationTtl: CHALLENGE_TTL }
        );

        return {
            challenge: challengeB64,
            timeout: 300000,
            rpId,
            userVerification: 'preferred'
        };
    },

    async verifyAuthentication(c, credential) {
        const { id, response: credResponse } = credential;

        if (!id || !credResponse?.clientDataJSON || !credResponse?.authenticatorData || !credResponse?.signature) {
            throw new BizError(t('passkeyInvalidCredential'));
        }

        const clientDataBytes = base64urlDecode(credResponse.clientDataJSON);
        const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));

        if (clientData.type !== 'webauthn.get') {
            throw new BizError(t('passkeyInvalidCredential'));
        }

        const challengeData = await c.env.kv.get(KvConst.PASSKEY_CHALLENGE + clientData.challenge, { type: 'json' });
        await c.env.kv.delete(KvConst.PASSKEY_CHALLENGE + clientData.challenge);

        if (!challengeData || challengeData.type !== 'login') {
            throw new BizError(t('passkeyChallengeInvalid'));
        }

        const rpId = new URL(c.req.url).hostname;
        const expectedOrigin = new URL(c.req.url).origin;

        if (clientData.origin !== expectedOrigin) {
            const referer = c.req.header('referer') || c.req.header('origin');
            if (referer) {
                const refOrigin = new URL(referer).origin;
                if (clientData.origin !== refOrigin) {
                    throw new BizError(t('passkeyOriginMismatch'));
                }
            } else {
                throw new BizError(t('passkeyOriginMismatch'));
            }
        }

        const storedKey = await orm(c)
            .select()
            .from(userPasskey)
            .where(eq(userPasskey.credentialId, id))
            .get();

        if (!storedKey) {
            throw new BizError(t('passkeyNotFound'));
        }

        const authDataBytes = base64urlDecode(credResponse.authenticatorData);
        const parsed = parseAuthenticatorData(new Uint8Array(authDataBytes));

        const rpIdHashExpected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
        let rpIdMatch = true;
        for (let i = 0; i < 32; i++) {
            if (parsed.rpIdHash[i] !== rpIdHashExpected[i]) {
                rpIdMatch = false;
                break;
            }
        }

        if (!rpIdMatch) {
            throw new BizError(t('passkeyRpIdMismatch'));
        }

        if (!(parsed.flags & 0x01)) {
            throw new BizError(t('passkeyUserNotPresent'));
        }

        const keyData = JSON.parse(storedKey.publicKey);
        const publicKeyBytes = base64urlDecode(keyData.key);
        const alg = keyData.alg;

        let algorithm;
        if (alg === -7) {
            algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
        } else if (alg === -257 || alg === -37) {
            algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
        } else {
            throw new BizError(t('passkeyUnsupportedAlg'));
        }

        let cryptoKey;
        if (alg === -7) {
            cryptoKey = await crypto.subtle.importKey('raw', publicKeyBytes, algorithm, false, ['verify']);
        } else {
            const n = publicKeyBytes.slice(0, publicKeyBytes.length - 3);
            const e = publicKeyBytes.slice(publicKeyBytes.length - 3);
            const jwk = { kty: 'RSA', n: base64urlEncode(n), e: base64urlEncode(e), alg: 'RS256' };
            cryptoKey = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
        }

        const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
        const signedData = new Uint8Array(authDataBytes.length + clientDataHash.length);
        signedData.set(new Uint8Array(authDataBytes), 0);
        signedData.set(clientDataHash, authDataBytes.length);

        const signatureBytes = base64urlDecode(credResponse.signature);

        let verifyAlg;
        let sigForVerify;
        if (alg === -7) {
            verifyAlg = { name: 'ECDSA', hash: 'SHA-256' };
            sigForVerify = derToRaw(signatureBytes);
        } else {
            verifyAlg = { name: 'RSASSA-PKCS1-v1_5' };
            sigForVerify = signatureBytes;
        }

        const valid = await crypto.subtle.verify(verifyAlg, cryptoKey, sigForVerify, signedData);

        if (!valid) {
            throw new BizError(t('passkeyVerifyFailed'));
        }

        await orm(c)
            .update(userPasskey)
            .set({ signCount: parsed.signCount })
            .where(eq(userPasskey.id, storedKey.id))
            .run();

        const userRow = await userService.selectByIdIncludeDel(c, storedKey.userId);

        if (!userRow) {
            throw new BizError(t('notExistUser'));
        }

        if (userRow.isDel === isDel.DELETE) {
            throw new BizError(t('isDelUser'));
        }

        if (userRow.status === userConst.status.BAN) {
            throw new BizError(t('isBanUser'));
        }

        const token = await loginService.createSession(c, userRow);
        return { token };
    },

    listByUserId(c, userId) {
        return orm(c)
            .select({
                id: userPasskey.id,
                credentialId: userPasskey.credentialId,
                name: userPasskey.name,
                createTime: userPasskey.createTime
            })
            .from(userPasskey)
            .where(eq(userPasskey.userId, userId))
            .all();
    },

    async deleteById(c, userId, id) {
        await orm(c)
            .delete(userPasskey)
            .where(and(eq(userPasskey.id, id), eq(userPasskey.userId, userId)))
            .run();
    }
};

export default passkeyService;

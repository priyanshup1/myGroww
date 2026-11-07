/**
 * Encrypts a backup so it can sit on a public website and still be readable only with the
 * passphrase: AES-256-GCM, with the key derived from the passphrase by PBKDF2.
 * This is only as strong as the passphrase, so use a long random one.
 */
const ITERATIONS = 600000;

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function toBase64Large(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(out);
}

async function deriveKey(passphrase, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealVault(data, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, ITERATIONS);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
    return { app: 'mygroww-vault', version: 1, iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), data: toBase64Large(new Uint8Array(cipher)) };
}

/** Returns the original data. Throws if the passphrase is wrong or the file was altered. */
export async function openVault(vault, passphrase) {
    if (!vault || vault.app !== 'mygroww-vault') throw new Error('This is not a myGroww data file.');
    const key = await deriveKey(passphrase, fromBase64(vault.salt), vault.iterations);
    let plain;
    try {
        plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(vault.iv) }, key, fromBase64(vault.data));
    } catch {
        throw new Error('That passphrase did not work. Check it and try again.');
    }
    return JSON.parse(new TextDecoder().decode(plain));
}

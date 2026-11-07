/* eslint-env node */
/**
 * Encrypts private-data/mygroww_backup_my_data.json into public/vault.json.
 * A random passphrase is created once, kept in private-data/passphrase.txt, and never printed.
 * Usage: npx vite-node scripts/seal-data.js
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { sealVault } from '../src/core/vault';

const SOURCE = 'private-data/mygroww_backup_my_data.json';
const PASSPHRASE = 'private-data/passphrase.txt';
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newPassphrase() {
    const groups = [];
    for (let g = 0; g < 6; g += 1) {
        let text = '';
        for (const byte of randomBytes(4)) text += ALPHABET[byte % ALPHABET.length];
        groups.push(text);
    }
    return groups.join('-');
}

if (!existsSync(PASSPHRASE)) writeFileSync(PASSPHRASE, `${newPassphrase()}\n`);
const passphrase = readFileSync(PASSPHRASE, 'utf8').trim();
const vault = await sealVault(JSON.parse(readFileSync(SOURCE, 'utf8')), passphrase);
writeFileSync('public/vault.json', `${JSON.stringify(vault)}\n`);
console.log('Encrypted. Passphrase is in', PASSPHRASE);

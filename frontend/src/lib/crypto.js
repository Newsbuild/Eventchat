// E2E Encryption using Web Crypto API
// - RSA-OAEP-2048 for per-recipient key wrapping
// - AES-256-GCM for message body encryption
// - Private key stored in localStorage; optional password-encrypted backup on server
//
// Design summary:
//   sender generates one-time AES key -> encrypts plaintext (AES-GCM iv)
//   for each recipient (including self), wraps the AES key with recipient's RSA public key
//   server stores { ciphertext (as text on server), enc_iv, enc_keys: {user_id: b64} }
//   receiver looks up own wrapped key, unwraps with RSA private key, decrypts ciphertext.

const KEY_LOCAL_STORAGE = "eventchat.privkey";
const KEY_USER_ID = "eventchat.privkey.uid";

// ---------- Encoding ----------
function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}
function fromB64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out.buffer;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- RSA key handling ----------
export async function generateKeyPair() {
    const kp = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
    );
    const pubSpki = await crypto.subtle.exportKey("spki", kp.publicKey);
    const privPkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
    return { publicKeyB64: b64(pubSpki), privateKeyB64: b64(privPkcs8) };
}

export async function importPublicKey(pubB64) {
    return crypto.subtle.importKey("spki", fromB64(pubB64),
        { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}

export async function importPrivateKey(privB64) {
    return crypto.subtle.importKey("pkcs8", fromB64(privB64),
        { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

// ---------- Local key storage ----------
export function saveLocalPrivateKey(userId, privB64) {
    localStorage.setItem(KEY_USER_ID, userId);
    localStorage.setItem(KEY_LOCAL_STORAGE, privB64);
}

export function loadLocalPrivateKey(userId) {
    const uid = localStorage.getItem(KEY_USER_ID);
    if (uid !== userId) return null;
    return localStorage.getItem(KEY_LOCAL_STORAGE);
}

export function clearLocalPrivateKey() {
    localStorage.removeItem(KEY_LOCAL_STORAGE);
    localStorage.removeItem(KEY_USER_ID);
}

// ---------- Password-based backup (PBKDF2 -> AES-GCM) ----------
async function deriveBackupKey(password, salt) {
    const material = await crypto.subtle.importKey("raw", enc.encode(password),
        { name: "PBKDF2" }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptPrivateKeyForBackup(privB64, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveBackupKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(privB64));
    return JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}

export async function decryptPrivateKeyBackup(backupJson, password) {
    const { salt, iv, ct } = JSON.parse(backupJson);
    const key = await deriveBackupKey(password, new Uint8Array(fromB64(salt)));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(fromB64(iv)) }, key, fromB64(ct));
    return dec.decode(plain);
}

// ---------- Encrypt / Decrypt messages ----------
// Returns { ciphertext, enc_iv, enc_keys: {userId: b64WrappedAesKey} }
export async function encryptForRecipients(plaintext, recipients) {
    // recipients: [{ id, public_key }]
    const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plaintext));
    const rawAes = await crypto.subtle.exportKey("raw", aesKey);
    const enc_keys = {};
    for (const r of recipients) {
        if (!r.public_key) continue;
        const pub = await importPublicKey(r.public_key);
        const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, rawAes);
        enc_keys[r.id] = b64(wrapped);
    }
    return {
        ciphertext: b64(ct),
        enc_iv: b64(iv),
        enc_keys,
    };
}

// Cache decrypted messages: id -> plaintext
const decryptCache = new Map();

export async function decryptMessage(message, myUserId, myPrivateKeyImported) {
    if (!message?.encrypted) return message?.text ?? "";
    if (decryptCache.has(message.id)) return decryptCache.get(message.id);
    const wrapped = message.enc_keys?.[myUserId];
    if (!wrapped) {
        // not encrypted for us — likely legacy or wrong keypair
        return null;
    }
    try {
        const aesRaw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, myPrivateKeyImported, fromB64(wrapped));
        const aesKey = await crypto.subtle.importKey("raw", aesRaw, "AES-GCM", false, ["decrypt"]);
        const iv = new Uint8Array(fromB64(message.enc_iv));
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, fromB64(message.text || message.ciphertext || ""));
        const text = dec.decode(plain);
        decryptCache.set(message.id, text);
        return text;
    } catch (err) {
        console.error("Decrypt failed for", message.id, err);
        return null;
    }
}

export function clearDecryptCache() {
    decryptCache.clear();
}

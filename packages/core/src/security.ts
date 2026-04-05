import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export interface EncryptedSecretPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(
  password: string,
  storedPasswordHash: string,
): boolean {
  const [algorithm, saltBase64, hashBase64] = storedPasswordHash.split("$");

  if (algorithm !== "scrypt" || !saltBase64 || !hashBase64) {
    return false;
  }

  const salt = Buffer.from(saltBase64, "base64url");
  const expected = Buffer.from(hashBase64, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return timingSafeEqual(actual, expected);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function encryptSecret(
  plaintext: string,
  encryptionSecret: string | undefined,
  workspaceId: string,
): EncryptedSecretPayload {
  const key = deriveEncryptionKey(encryptionSecret, workspaceId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: 1,
  };
}

export function decryptSecret(
  payload: EncryptedSecretPayload,
  encryptionSecret: string | undefined,
  workspaceId: string,
): string {
  const key = deriveEncryptionKey(encryptionSecret, workspaceId);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function deriveEncryptionKey(
  secret: string | undefined,
  workspaceId: string,
): Buffer {
  if (!secret) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is required to encrypt or decrypt stored secrets.",
    );
  }

  return createHash("sha256")
    .update(`${workspaceId}:${secret}`)
    .digest();
}

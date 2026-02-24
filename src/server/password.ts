import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SALT_LEN = 16;
const KEY_LEN = 64;
const COST = 16384;

/** Хеширует пароль для сохранения в БД (salt включён в строку). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

/** Проверяет пароль против сохранённого хеша. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const storedKey = Buffer.from(keyHex, "hex");
  if (key.length !== storedKey.length) return false;
  return timingSafeEqual(key, storedKey);
}

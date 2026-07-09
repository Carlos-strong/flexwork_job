/**
 * Module de persistance locale (fichier JSON)
 *
 * Permet de sauvegarder et restaurer les données des stores en mémoire
 * pour survivre aux redémarrages du serveur (VS Code, dev, etc.)
 *
 * Les données sont stockées dans le dossier `.data/` à la racine du projet.
 * Utilise `globalThis` pour éviter les doublons de chargement en hot-reload.
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

// Cache pour éviter de relire le disque à chaque chargement
declare global {
  // eslint-disable-next-line no-var
  var __persistCache: Record<string, unknown> | undefined;
}

const cache: Record<string, unknown> =
  globalThis.__persistCache ?? (globalThis.__persistCache = {});

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Sauvegarde une donnée dans un fichier JSON sur disque.
 * @param key Identifiant unique (sert de nom de fichier)
 * @param data Donnée à sérialiser
 */
export function saveToDisk<T>(key: string, data: T): void {
  try {
    ensureDir();
    const filePath = path.join(DATA_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    cache[key] = data;
  } catch (err) {
    console.error(`[persist] Erreur sauvegarde "${key}":`, err);
  }
}

/**
 * Charge une donnée depuis un fichier JSON sur disque.
 * @param key Identifiant unique
 * @param defaultValue Valeur par défaut si le fichier n'existe pas
 */
export function loadFromDisk<T>(key: string, defaultValue: T): T {
  // Vérifier le cache mémoire d'abord
  if (key in cache) {
    return cache[key] as T;
  }

  try {
    const filePath = path.join(DATA_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as T;
      cache[key] = data;
      return data;
    }
  } catch (err) {
    console.warn(`[persist] Erreur chargement "${key}":`, err);
  }

  return defaultValue;
}

/**
 * Vide le cache mémoire et le fichier sur disque pour une clé.
 */
export function clearDisk(key: string): void {
  delete cache[key];
  try {
    const filePath = path.join(DATA_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignorer
  }
}

/**
 * Vérifie si des données existent pour une clé.
 */
export function existsOnDisk(key: string): boolean {
  if (key in cache) return true;
  const filePath = path.join(DATA_DIR, `${key}.json`);
  return fs.existsSync(filePath);
}

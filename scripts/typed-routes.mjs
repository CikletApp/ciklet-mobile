// Expo Router'ın tipli rota bildirimini (.expo/types/router.d.ts) ve
// expo-env.d.ts'i Metro'yu başlatmadan üretir.
//
// İkisi de git'e girmez (.gitignore); normalde `expo start` yazar. Temiz
// klonda `npm run typecheck` (ya da `npm ci` sonrası postinstall) bu betiği
// çalıştırır, böylece yeni bir rota (ör. /games/details) elle düzenleme
// gerektirmeden tsc'den geçer.
//
//   node scripts/typed-routes.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(root, "src", "app");
const typesDir = path.join(root, ".expo", "types");

// index.js yüklenirken EXPO_ROUTER_APP_ROOT'u okur; önce ayarlanmalı.
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const soft = process.argv.includes("--soft");
try {
  main();
} catch (error) {
  // postinstall'da (--soft) kurulumu bozmasın; typecheck'te hata versin.
  console.error("typed-routes:", error instanceof Error ? error.message : error);
  if (!soft) process.exit(1);
}

function main() {
  const require = createRequire(path.join(root, "package.json"));
  // @expo/router-server, expo'nun kendi @expo/cli'sinin bağımlılığı (kök
  // node_modules'a çıkmayabilir); oradan çözülür.
  const expoPkg = require.resolve("expo/package.json");
  const cliPkg = createRequire(expoPkg).resolve("@expo/cli/package.json");
  const fromCli = createRequire(cliPkg);
  const { getTypedRoutesDeclarationFile } = fromCli("@expo/router-server/build/typed-routes/generate");
  const { EXPO_ROUTER_CTX_IGNORE } = fromCli("expo-router/_ctx-shared");
  const { requireContext } = fromCli("expo-router/internal/testing");

  const ctx = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
  const file = getTypedRoutesDeclarationFile(ctx, {});
  if (!file) {
    throw new Error("rota bildirimi üretilemedi");
}
fs.mkdirSync(typesDir, { recursive: true });
fs.writeFileSync(path.join(typesDir, "router.d.ts"), file);

const envFile = path.join(root, "expo-env.d.ts");
if (!fs.existsSync(envFile)) {
  fs.writeFileSync(
    envFile,
    '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore',
  );
}
console.log("typed-routes: .expo/types/router.d.ts yazıldı");
}

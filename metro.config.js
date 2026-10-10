const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Yerel derleme çıktıları izlenmez: `expo prebuild` android/'i silip yeniden
// kurunca izleyici silinen `.cxx`/`build` klasörlerinde ENOENT ile çöküyor,
// Metro düşüyor ve geliştirme istemcisi beyaz ekranda kalıyordu.
const nativeBuildDirs = /[\\/](android[\\/](app[\\/])?(build|\.cxx|\.gradle)|ios[\\/](build|Pods))[\\/].*/;
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  nativeBuildDirs,
];

module.exports = config;

// node --import ./tests/helpers/register-ts.mjs --test tests/<dosya>.test.mjs
import { register } from "node:module";
register(new URL("./ts-resolve-hook.mjs", import.meta.url).href);

/* @ts-self-types="./license_verifier.d.ts" */

import * as wasm from "./license_verifier_bg.wasm";
import { __wbg_set_wasm } from "./license_verifier_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    verify_license_wasm
} from "./license_verifier_bg.js";

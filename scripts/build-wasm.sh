#!/bin/bash
cd native/license-verifier
wasm-pack build --target nodejs --out-dir ../../pkg

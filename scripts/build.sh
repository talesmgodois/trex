#!/bin/bash

APP_NAME="trex"
DIST_DIR="./dist/artifacts"
LIB_DIR="./src/lib"
LIB_FILE="$LIB_DIR/trex.lib.ts"

echo "🚀 Iniciando build para $APP_NAME..."

# Limpa builds anteriores
rm -rf ./dist
mkdir -p $DIST_DIR

# --- Library build (ESM + types) ---

echo "📚 Building library (ESM)..."
bun build ./src/lib/trex.lib.ts --target node --format esm --outdir ./dist

if [ $? -ne 0 ]; then
    echo "❌ Erro ao compilar library"
    exit 1
fi

echo "📝 Generating type declarations..."
tsc --project tsconfig.build.json

if [ $? -ne 0 ]; then
    echo "❌ Erro ao gerar declarações de tipo"
    exit 1
fi

echo "✅ Library gerada em ./dist/trex.lib.js"

# --- Executables build ---

# Lista de targets: [NOME_DO_ARQUIVO] [TARGET_DO_BUN]
targets=(
  "trex-linux-x64:bun-linux-x64"
  "trex-macos-arm64:bun-darwin-arm64"
  "trex-win-x64.exe:bun-windows-x64"
)

for entry in "${targets[@]}"; do
    FILENAME="${entry%%:*}"
    TARGET="${entry#*:}"

    TARGET_DIR="$DIST_DIR/$FILENAME"
    mkdir -p "$TARGET_DIR"

    echo "📦 Compilando executável para $TARGET..."
    bun build ./src/index.ts --compile --target "$TARGET" --outfile "$TARGET_DIR/$FILENAME"

    if [ $? -eq 0 ]; then
        echo "✅ Gerado: $TARGET_DIR/$FILENAME"
    else
        echo "❌ Erro ao compilar para $TARGET"
        exit 1
    fi
done

echo "🎉 Build concluído. Library em ./dist/ | Binários em $DIST_DIR"
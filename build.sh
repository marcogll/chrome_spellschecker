#!/bin/bash

# Script para empaquetar la extensión SpellCheck Open para distribución

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Empaquetando SpellCheck Open...${NC}"

# Obtener la versión del manifest
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Error: No se pudo obtener la versión del manifest.json${NC}"
    exit 1
fi

# Crear nombre del archivo
PACKAGE_NAME="spellcheck-open-v${VERSION}.zip"

# Verificar que estamos en el directorio correcto
if [ ! -f "manifest.json" ]; then
    echo -e "${RED}❌ Error: No se encuentra manifest.json. Ejecuta este script desde la raíz del proyecto.${NC}"
    exit 1
fi

# Limpiar build anterior si existe
if [ -f "$PACKAGE_NAME" ]; then
    echo -e "${YELLOW}🗑️  Eliminando paquete anterior: $PACKAGE_NAME${NC}"
    rm "$PACKAGE_NAME"
fi

# Crear lista de archivos a incluir (excluyendo archivos innecesarios)
echo -e "${YELLOW}📁 Archivos a incluir:${NC}"

# Archivos y carpetas necesarios
INCLUDE_LIST=(
    "manifest.json"
    "popup.html"
    "popup.js"
    "src/"
    "_locales/"
    "icons/"
)

# Mostrar archivos que se incluirán
for item in "${INCLUDE_LIST[@]}"; do
    if [ -e "$item" ]; then
        echo "  ✓ $item"
    else
        echo -e "  ${RED}✗ $item (NO ENCONTRADO)${NC}"
    fi
done

# Crear el zip
echo -e "${YELLOW}🗜️  Creando $PACKAGE_NAME...${NC}"

# Usar zip excluyendo archivos ocultos y no necesarios
zip -r "$PACKAGE_NAME" \
    manifest.json \
    popup.html \
    popup.js \
    src/ \
    _locales/ \
    icons/ \
    -x "*/.DS_Store" \
    -x "*/.git*" \
    -x "*/node_modules/*" \
    -x "*/.vscode/*" \
    -x "*/__MACOSX/*"

# Verificar que se creó correctamente
if [ -f "$PACKAGE_NAME" ]; then
    SIZE=$(ls -lh "$PACKAGE_NAME" | awk '{ print $5 }')
    echo -e "${GREEN}✅ Paquete creado exitosamente: $PACKAGE_NAME (${SIZE})${NC}"
    
    # Listar contenido del zip
    echo -e "${YELLOW}📋 Contenido del paquete:${NC}"
    unzip -l "$PACKAGE_NAME" | tail -20
else
    echo -e "${RED}❌ Error: No se pudo crear el paquete${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Listo para distribuir o cargar en Chrome!${NC}"

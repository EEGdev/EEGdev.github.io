# Inventario documental

Herramienta estática para generar un mapa de archivos y carpetas mediante metadatos. Incluye una aplicación web y una alternativa CLI para Windows.

## Principios

- No abre ni analiza el contenido de los documentos.
- No transmite archivos ni metadatos a un servidor.
- No requiere cuentas, extensiones, paquetes ni instalaciones.
- La aplicación web funciona en el navegador.
- La CLI usa Windows PowerShell, incluido en Windows.
- Los resultados siguen el mismo contrato de columnas.

## Aplicación web

Abre la página publicada y selecciona una carpeta. La aplicación recorre sus subcarpetas y genera un ZIP con:

- **archivos.csv**: un registro por archivo.
- **carpetas.csv**: estructura, profundidad, archivos directos y recursivos, y tamaño.
- **extensiones.csv**: cantidad por extensión.
- **modificaciones_por_fecha.csv**: cantidad de archivos por mes y año de última modificación. Incluye los campos anio, mes, periodo y cantidad.
- **resumen.txt**: totales y alcance del análisis.

Al terminar, la aplicación descarga el ZIP y abre un correo nuevo con el asunto y los campos de referencia preparados. Por seguridad, el navegador no permite adjuntar archivos automáticamente mediante mailto. La persona debe adjuntar el ZIP descargado.

La aplicación consulta nombres, rutas, tamaños y fechas de modificación. No lee el contenido de los archivos.

### Compatibilidad del navegador

La aplicación usa showDirectoryPicker() cuando está disponible. Si no está disponible, usa el selector de carpetas webkitdirectory. El segundo método puede no informar carpetas vacías.

La fecha de creación no está disponible de forma consistente en la API web. Por eso, fechaCreacion queda vacía en el CSV web. La CLI de Windows sí incluye esa fecha.

Se recomienda usar una versión actual de Edge, Chrome o Firefox. La aplicación requiere HTTPS para la API moderna de selección de carpetas. GitHub Pages ofrece HTTPS.

## CLI de Windows

1. Copia inventory.bat dentro de la carpeta que deseas analizar.
2. Haz doble clic en el archivo.
3. Espera el mensaje de finalización.
4. Busca los resultados en Escritorio/Inventario_documental.

El archivo BAT contiene el código PowerShell. No necesita un archivo auxiliar.

La ejecución usa ExecutionPolicy Bypass solo para ese proceso. Una política corporativa puede bloquear scripts aunque se use este parámetro. No modifica la política permanente del equipo.

La CLI genera los mismos CSV. También incluye la fecha de creación del sistema de archivos.

## Modelo de datos

### archivos.csv

| Campo | Descripción |
|---|---|
| rutaRelativa | Ruta desde la carpeta analizada. |
| nombre | Nombre del archivo. |
| extension | Extensión en minúsculas o (sin extensión). |
| tamanoBytes | Tamaño en bytes. |
| tamanoMB | Tamaño en MB, redondeado a tres decimales. |
| fechaCreacion | Fecha de creación; vacía en la web. |
| ultimaModificacion | Fecha de última modificación, ISO 8601. |
| anioModificacion | Año de última modificación. |

### carpetas.csv

| Campo | Descripción |
|---|---|
| rutaRelativa | Ruta desde la carpeta analizada. La raíz usa punto. |
| nombre | Nombre de la carpeta. |
| nivel | Profundidad respecto de la raíz. |
| archivosDirectos | Archivos que están directamente en esa carpeta. |
| archivosRecursivos | Archivos de esa carpeta y sus descendientes. |
| tamanoTotalBytes | Tamaño acumulado de esos archivos. |

La fila de raíz aparece en carpetas.csv, pero no se cuenta como subcarpeta en el resumen.

## Privacidad y límites

- El navegador solo recibe acceso después de que la persona selecciona una carpeta.
- No hay backend, analítica, telemetría ni dependencias externas.
- GitHub Pages entrega los archivos estáticos. El procesamiento ocurre en el equipo del participante.
- Los permisos de lectura dependen del sistema operativo y del navegador.
- Los archivos bloqueados o inaccesibles pueden producir errores de lectura.
- La aplicación no sigue enlaces simbólicos.
- Los resultados describen los metadatos visibles en el momento del análisis.

## Arquitectura

core/inventory-core.js contiene el modelo de inventario web y sus reglas de normalización. app.js conecta el navegador con el modelo y genera el ZIP.

La CLI integra su motor PowerShell dentro de un único archivo BAT. No puede ejecutar el núcleo JavaScript sin instalar un runtime adicional. Por eso, ambas implementaciones comparten el contrato de datos y las reglas documentadas, no el mismo código ejecutable.

## Publicación

El proyecto se aloja como sitio estático en GitHub Pages. No necesita proceso de compilación ni paquetes.
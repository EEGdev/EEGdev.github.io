# Lista de pruebas manuales

## Web

- [ ] Seleccionar una carpeta vacía.
- [ ] Seleccionar una carpeta con archivos en la raíz.
- [ ] Seleccionar una carpeta con tres niveles de subcarpetas.
- [ ] Confirmar que se incluyen archivos sin extensión.
- [ ] Confirmar que se incluyen nombres con espacios, acentos, comas y comillas.
- [ ] Confirmar que aparecen carpetas vacías con el selector moderno.
- [ ] Confirmar que el selector alternativo informa las carpetas que contienen archivos.
- [ ] Comparar conteos y tamaños con el Explorador de Windows.
- [ ] Confirmar que fechaCreacion queda vacía en el CSV web.
- [ ] Confirmar que no se realizan solicitudes de red durante el análisis.
- [ ] Cancelar el selector y confirmar que la página sigue funcionando.

## CLI

- [ ] Ejecutar con doble clic desde una carpeta local.
- [ ] Ejecutar desde una ruta con espacios y acentos.
- [ ] Ejecutar desde una carpeta vacía.
- [ ] Ejecutar desde una unidad sincronizada.
- [ ] Confirmar que los resultados no se incluyen al analizar el Escritorio.
- [ ] Confirmar que las fechas usan ISO 8601.
- [ ] Confirmar que errores.txt solo aparece cuando hay errores.
- [ ] Confirmar que una política corporativa puede bloquear la ejecución.

## Comparación de resultados

- [ ] Comparar archivos.csv web y CLI en la misma carpeta.
- [ ] Comparar carpetas.csv y validar conteos directos y recursivos.
- [ ] Comparar extensiones.csv.
- [ ] Comparar modificaciones_por_anio.csv.
- [ ] Verificar diferencias documentadas de fecha de creación y carpetas vacías en el selector alternativo.

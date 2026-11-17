(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const chooseButton = $("choose-folder");
  const fallbackInput = $("folder-fallback");
  const selectionLabel = $("selection-label");
  const progressPanel = $("progress-panel");
  const progressTitle = $("progress-title");
  const progressCount = $("progress-count");
  const progressBar = $("progress-bar");
  const progressMessage = $("progress-message");
  const resultsSection = $("results");
  let currentInventory = null;

  chooseButton.addEventListener("click", async () => {
    if ("showDirectoryPicker" in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: "read" });
        await scanDirectoryHandle(handle);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    fallbackInput.click();
  });

  fallbackInput.addEventListener("change", async () => {
    const selected = Array.from(fallbackInput.files || []);
    if (!selected.length) return;
    const firstPath = selected[0].webkitRelativePath || selected[0].name;
    const rootName = firstPath.split("/")[0] || "Carpeta seleccionada";
    const entries = selected.map((file) => ({ file, relativePath: file.webkitRelativePath || file.name }));
    selectionLabel.textContent = "Carpeta seleccionada: " + rootName;
    await processEntries(entries, [], rootName);
    fallbackInput.value = "";
  });

  $("reset").addEventListener("click", () => {
    currentInventory = null;
    resultsSection.hidden = true;
    progressPanel.hidden = true;
    selectionLabel.textContent = "Ninguna carpeta seleccionada.";
    progressBar.style.width = "0%";
  });

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!currentInventory) return;
      const kind = button.dataset.export;
      const exports = {
        files: { name: "archivos.csv", rows: currentInventory.files, columns: ["rutaRelativa", "nombre", "extension", "tamanoBytes", "tamanoMB", "fechaCreacion", "ultimaModificacion", "anioModificacion"] },
        folders: { name: "carpetas.csv", rows: currentInventory.folders, columns: ["rutaRelativa", "nombre", "nivel", "archivosDirectos", "archivosRecursivos", "tamanoTotalBytes"] },
        extensions: { name: "extensiones.csv", rows: currentInventory.extensions, columns: ["extension", "cantidad"] },
        years: { name: "modificaciones_por_anio.csv", rows: currentInventory.years, columns: ["anio", "cantidad"] }
      };
      if (kind === "summary") {
        downloadText("resumen.txt", summaryText(currentInventory.summary), "text/plain;charset=utf-8");
      } else if (exports[kind]) {
        const item = exports[kind];
        downloadText(item.name, toCsv(item.rows, item.columns), "text/csv;charset=utf-8");
      }
    });
  });

  async function scanDirectoryHandle(rootHandle) {
    selectionLabel.textContent = "Carpeta seleccionada: " + rootHandle.name;
    progressPanel.hidden = false;
    resultsSection.hidden = true;
    progressTitle.textContent = "Recorriendo carpetas…";
    progressMessage.textContent = "Consultando nombres y metadatos. No se leen los contenidos.";
    progressBar.style.width = "12%";
    const entries = [];
    const folders = [];
    let readErrors = 0;

    async function walk(directoryHandle, relativePath) {
      folders.push(relativePath || ".");
      for await (const entry of directoryHandle.values()) {
        const childPath = relativePath ? relativePath + "/" + entry.name : entry.name;
        if (entry.kind === "directory") {
          await walk(entry, childPath);
        } else if (entry.kind === "file") {
          try {
            const file = await entry.getFile();
            entries.push({ file, relativePath: childPath });
            if (entries.length % 250 === 0) {
              progressCount.textContent = entries.length.toLocaleString("es-MX") + " archivos";
              await yieldToBrowser();
            }
          } catch (error) {
            readErrors += 1;
          }
        }
      }
    }

    try {
      await walk(rootHandle, "");
    } catch (error) {
      readErrors += 1;
    }
    await processEntries(entries, folders, rootHandle.name, readErrors);
  }

  async function processEntries(entries, folders, rootName, initialErrors) {
    progressPanel.hidden = false;
    resultsSection.hidden = true;
    progressTitle.textContent = "Preparando inventario…";
    progressCount.textContent = entries.length.toLocaleString("es-MX") + " archivos";
    progressBar.style.width = "72%";
    progressMessage.textContent = "Agrupando carpetas, extensiones y fechas.";
    await yieldToBrowser();

    currentInventory = window.InventoryCore.buildInventory(entries, folders, rootName);
    currentInventory.summary.erroresLectura = Number(initialErrors) || 0;
    $("stat-files").textContent = currentInventory.summary.archivos.toLocaleString("es-MX");
    $("stat-folders").textContent = currentInventory.summary.carpetas.toLocaleString("es-MX");
    $("stat-size").textContent = formatBytes(currentInventory.summary.tamanoTotalBytes);
    $("stat-errors").textContent = currentInventory.summary.erroresLectura.toLocaleString("es-MX");
    progressBar.style.width = "100%";
    progressTitle.textContent = "Análisis completado";
    progressCount.textContent = currentInventory.summary.archivos.toLocaleString("es-MX") + " archivos";
    progressMessage.textContent = "Los resultados están listos para descargar.";
    resultsSection.hidden = false;
  }

  function toCsv(rows, columns) {
    const escapeCell = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [columns.map(escapeCell).join(",")];
    for (const row of rows) lines.push(columns.map((column) => escapeCell(row[column])).join(","));
    return "\uFEFF" + lines.join("\r\n");
  }

  function summaryText(summary) {
    return [
      "INVENTARIO DOCUMENTAL",
      "Fecha de análisis: " + summary.fechaAnalisis,
      "Carpeta analizada: " + summary.carpetaAnalizada,
      "Archivos: " + summary.archivos,
      "Carpetas: " + summary.carpetas,
      "Tamaño total (bytes): " + summary.tamanoTotalBytes,
      "Tamaño total (MB): " + summary.tamanoTotalMB,
      "Errores de lectura: " + summary.erroresLectura,
      "",
      "El análisis consultó metadatos. No abrió ni transmitió documentos."
    ].join("\r\n");
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 MB";
    const mb = bytes / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(2) + " GB" : mb.toFixed(2) + " MB";
  }

  function yieldToBrowser() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
})();
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
  const reportButton = $("generate-report");
  const sendButton = $("send-report");
  const reportMessage = $("report-message");
  const infoDialog = $("info-dialog");
  const dialogTitle = $("dialog-title");
  const dialogMessage = $("dialog-message");
  const dialogConfirm = $("dialog-confirm");
  let currentInventory = null;
  let dialogAction = null;
  let reportReady = false;
  let reportDetails = null;

  function showDialog(title, message, confirmLabel, action) {
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogConfirm.textContent = confirmLabel;
    dialogAction = action;
    infoDialog.showModal();
  }

  dialogConfirm.addEventListener("click", (event) => {
    event.preventDefault();
    const action = dialogAction;
    dialogAction = null;
    infoDialog.close();
    if (action) action();
  });

  $("dialog-cancel").addEventListener("click", () => {
    dialogAction = null;
  });

  chooseButton.addEventListener("click", () => {
    showDialog(
      "Acceso local a la carpeta",
      "El análisis se hará en este equipo. Solo consultaremos nombres, rutas y metadatos; no abriremos, modificaremos ni enviaremos documentos. El navegador mostrará su propio permiso de acceso. Esta herramienta solicita lectura, no escritura.",
      "Continuar",
      openFolderPicker
    );
  });

  async function openFolderPicker() {
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
  }

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
    reportReady = false;
    reportDetails = null;
    sendButton.disabled = true;
    resultsSection.hidden = true;
    progressPanel.hidden = true;
    selectionLabel.textContent = "Ninguna carpeta seleccionada.";
    progressBar.style.width = "0%";
    reportMessage.textContent = "";
  });

  reportButton.addEventListener("click", () => {
    if (!currentInventory || reportButton.disabled) return;
    showDialog(
      "1. Generar archivo ZIP",
      "Se preparará un ZIP con el inventario de archivos, carpetas, extensiones, fechas y resumen. El archivo se guardará en las descargas de este equipo.",
      "Generar ZIP",
      generateZipReport
    );
  });

  function generateZipReport() {
    reportButton.disabled = true;
    reportMessage.textContent = "Preparando el archivo ZIP…";
    try {
      const date = localDateStamp(new Date());
      reportDetails = readParticipantDetails();
      const files = buildReportFiles(currentInventory, reportDetails);
      const zip = createZip(files);
      const filename = "Reporte_documentos_LEES_" + date + ".zip";
      downloadBlob(filename, zip);
      reportReady = true;
      sendButton.disabled = false;
      reportMessage.textContent = "ZIP generado y descargado. Continúa para preparar y enviarlo por correo.";
      showDialog("3. Enviar por correo", "El ZIP ya está en las descargas de este equipo. Se abrirá un correo dirigido a Emilio Espinosa (emilioeeg@gmail.com). NO OLVIDES ADJUNTAR EL ZIP ANTES DE ENVIAR EL CORREO.", "Abrir correo", openEmailDraft);
    } catch (error) {
      reportMessage.textContent = "No se pudo generar el reporte. Intenta nuevamente o selecciona una carpeta más pequeña.";
    } finally {
      reportButton.disabled = false;
    }
  }

  sendButton.addEventListener("click", () => {
    if (!reportReady) return;
    showDialog(
      "3. Enviar por correo",
      "Se abrirá un correo dirigido a Emilio Espinosa (emilioeeg@gmail.com). NO OLVIDES ADJUNTAR EL ZIP ANTES DE ENVIAR EL CORREO.",
      "Abrir correo",
      openEmailDraft
    );
  });

  function openEmailDraft() {
    const date = localDateStamp(new Date());
    const details = reportDetails || readParticipantDetails();
    const body = [
      "Por favor, completa estos campos para referencia:",
      "",
      "Usuario: " + (details.name || ""),
      "",
      "¿A qué corresponden estos archivos?",
      details.description || "",
      "",
      "Comentarios adicionales:",
      details.comments || "",
      "",
      "Adjunta el archivo ZIP descargado."
    ].join("\n");
    const subject = "Reporte de documentos LEES - " + date;
    const recipient = "emilioeeg@gmail.com";
    const mailto = "mailto:" + recipient + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    const mailLink = document.createElement("a");
    mailLink.href = mailto;
    mailLink.style.display = "none";
    document.body.appendChild(mailLink);
    mailLink.click();
    mailLink.remove();
    reportMessage.textContent = "Correo preparado. Recuerda adjuntar el ZIP antes de enviarlo.";
  }

  function readParticipantDetails() {
    return {
      name: $("participant-name").value.trim(),
      description: $("folder-description").value.trim(),
      comments: $("participant-comments").value.trim()
    };
  }

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
    progressMessage.textContent = "El reporte está listo para generar.";
    reportReady = false;
    sendButton.disabled = true;
    reportMessage.textContent = "";
    resultsSection.hidden = false;
    showDialog("2. Generar archivo ZIP", "La carpeta ya se analizó. El inventario contiene " + currentInventory.summary.archivos.toLocaleString("es-MX") + " archivos y " + currentInventory.summary.carpetas.toLocaleString("es-MX") + " carpetas. Genera el ZIP para continuar con el envío.", "Generar ZIP", generateZipReport);
  }

  function buildReportFiles(inventory, details) {
    const csv = (rows, columns) => toCsv(rows, columns);
    return [
      { name: "archivos.csv", content: csv(inventory.files, ["rutaRelativa", "nombre", "extension", "tamanoBytes", "tamanoMB", "fechaCreacion", "ultimaModificacion", "anioModificacion"]) },
      { name: "carpetas.csv", content: csv(inventory.folders, ["rutaRelativa", "nombre", "nivel", "archivosDirectos", "archivosRecursivos", "tamanoTotalBytes"]) },
      { name: "extensiones.csv", content: csv(inventory.extensions, ["extension", "cantidad"]) },
      { name: "modificaciones_por_anio.csv", content: csv(inventory.years, ["anio", "cantidad"]) },
      { name: "resumen.txt", content: summaryText(inventory.summary, details) }
    ];
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

  function summaryText(summary, details) {
    return [
      "INVENTARIO DOCUMENTAL LEES",
      "Fecha de análisis: " + summary.fechaAnalisis,
      "Carpeta analizada: " + summary.carpetaAnalizada,
      "Archivos: " + summary.archivos,
      "Carpetas: " + summary.carpetas,
      "Tamaño total (bytes): " + summary.tamanoTotalBytes,
      "Tamaño total (MB): " + summary.tamanoTotalMB,
      "Errores de lectura: " + summary.erroresLectura,
      "",
      "DATOS DE REFERENCIA",
      "Usuario: " + details.name,
      "Qué información contiene la carpeta: " + details.description,
      "Comentario: " + details.comments,
      "",
      "El análisis consultó metadatos localmente. No abrió ni transmitió documentos."
    ].join("\r\n");
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const stamp = dosDateTime(new Date());

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(name, 46);
      centralParts.push(central);
      offset += local.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function localDateStamp(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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

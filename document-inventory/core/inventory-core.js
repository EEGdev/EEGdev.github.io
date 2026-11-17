(function (global) {
  "use strict";
  const SCHEMA_VERSION = "1.0";

  function normalizeRelativePath(path, rootName) {
    const normalized = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (rootName && normalized.toLowerCase().startsWith(rootName.toLowerCase() + "/")) {
      return normalized.slice(rootName.length + 1);
    }
    return normalized;
  }

  function extensionOf(filename) {
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(dot).toLowerCase() : "(sin extensión)";
  }

  function isoDate(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    return new Date(timestamp).toISOString();
  }

  function buildInventory(inputFiles, explicitFolders, rootName) {
    const files = [];
    const folders = new Map();

    function ensureFolder(path) {
      const key = path || ".";
      if (!folders.has(key)) {
        const parts = key === "." ? [] : key.split("/");
        folders.set(key, {
          rutaRelativa: key,
          nombre: parts.length ? parts[parts.length - 1] : (rootName || "."),
          nivel: parts.length,
          archivosDirectos: 0,
          archivosRecursivos: 0,
          tamanoTotalBytes: 0
        });
      }
      return folders.get(key);
    }

    ensureFolder(".");
    for (const folderPath of explicitFolders || []) {
      const clean = normalizeRelativePath(folderPath, rootName).replace(/\/$/, "");
      if (!clean) continue;
      const parts = clean.split("/");
      for (let i = 1; i <= parts.length; i++) ensureFolder(parts.slice(0, i).join("/"));
    }

    for (const item of inputFiles || []) {
      const relativePath = normalizeRelativePath(item.relativePath || item.file.webkitRelativePath || item.file.name, rootName);
      const segments = relativePath.split("/").filter(Boolean);
      const filename = segments.pop() || item.file.name;
      const parentPath = segments.join("/") || ".";
      ensureFolder(parentPath).archivosDirectos += 1;

      let ancestor = parentPath;
      while (true) {
        const current = ensureFolder(ancestor);
        current.archivosRecursivos += 1;
        current.tamanoTotalBytes += Number(item.file.size) || 0;
        if (ancestor === ".") break;
        const index = ancestor.lastIndexOf("/");
        ancestor = index < 0 ? "." : ancestor.slice(0, index);
      }

      const modified = Number(item.file.lastModified) || 0;
      files.push({
        rutaRelativa: relativePath,
        nombre: filename,
        extension: extensionOf(filename),
        tamanoBytes: Number(item.file.size) || 0,
        tamanoMB: Number(((Number(item.file.size) || 0) / 1048576).toFixed(3)),
        fechaCreacion: item.creationDate || "",
        ultimaModificacion: isoDate(modified),
        anioModificacion: modified > 0 ? new Date(modified).getFullYear() : ""
      });
    }

    const folderRows = Array.from(folders.values()).sort((a, b) =>
      a.rutaRelativa.localeCompare(b.rutaRelativa, "es")
    );
    const extensionMap = new Map();
    const yearMap = new Map();
    let totalBytes = 0;

    for (const file of files) {
      extensionMap.set(file.extension, (extensionMap.get(file.extension) || 0) + 1);
      if (file.anioModificacion !== "") {
        yearMap.set(file.anioModificacion, (yearMap.get(file.anioModificacion) || 0) + 1);
      }
      totalBytes += file.tamanoBytes;
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      files,
      folders: folderRows,
      extensions: Array.from(extensionMap, ([extension, cantidad]) => ({ extension, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.extension.localeCompare(b.extension)),
      years: Array.from(yearMap, ([anio, cantidad]) => ({ anio, cantidad }))
        .sort((a, b) => b.anio - a.anio),
      summary: {
        carpetaAnalizada: rootName || "",
        archivos: files.length,
        carpetas: Math.max(0, folderRows.length - 1),
        tamanoTotalBytes: totalBytes,
        tamanoTotalMB: Number((totalBytes / 1048576).toFixed(2)),
        erroresLectura: 0,
        fechaAnalisis: new Date().toISOString()
      }
    };
  }

  global.InventoryCore = Object.freeze({ SCHEMA_VERSION, buildInventory, normalizeRelativePath });
})(window);
const DATABASE_NAME = "nelpac-form-drafts";
const STORE_NAME = "proof-files";
const DATABASE_VERSION = 1;

const openDraftDatabase = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withDraftStore = async (mode, operation) => {
  const database = await openDraftDatabase();
  if (!database) return null;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
};

export const loadFormDraft = async (key) => {
  let data = null;
  try {
    const raw = localStorage.getItem(key);
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  let proofFile = null;
  try {
    const stored = await withDraftStore("readonly", (store) => store.get(key));
    if (stored?.blob) {
      proofFile = new File([stored.blob], stored.name || "payment-proof", {
        type: stored.type || stored.blob.type,
        lastModified: stored.lastModified || Date.now(),
      });
    }
  } catch {
    proofFile = null;
  }

  return { data, proofFile };
};

export const saveFormDraftData = (key, data) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...data, savedAt: new Date().toISOString() }),
    );
  } catch {
    // A full or unavailable browser store must not interrupt form editing.
  }
};

export const saveFormDraftFile = async (key, file) => {
  try {
    if (!file) {
      await withDraftStore("readwrite", (store) => store.delete(key));
      return;
    }
    await withDraftStore("readwrite", (store) =>
      store.put(
        {
          blob: file,
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
        },
        key,
      ),
    );
  } catch {
    // The form data can still be restored even if the browser rejects the file.
  }
};

export const clearFormDraft = async (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures after a successful submission.
  }
  await saveFormDraftFile(key, null);
};

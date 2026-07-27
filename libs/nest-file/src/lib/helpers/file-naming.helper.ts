const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
};

export const generateStoredName = (originalName: string): string => {
  const timestamp = Date.now();
  const sanitized = sanitizeFileName(originalName);
  return `${timestamp}-${sanitized}`;
};

export const generateS3Key = (
  storedName: string,
  pathPrefix?: string
): string => {
  const prefix = pathPrefix ? pathPrefix.replace(/\/$/, '') : 'uploads';
  return `${prefix}/${storedName}`;
};

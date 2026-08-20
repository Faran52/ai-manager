export const saveTextFile = (fileName: string, text: string, mediaType = 'text/plain'): void => {
  const blob = new Blob([text], { type: `${mediaType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  }
  catch {
    return false;
  }
};

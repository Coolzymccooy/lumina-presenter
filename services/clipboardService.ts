const fallbackCopyWithTextarea = (text: string): boolean => {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

export const copyTextToClipboard = async (value: string): Promise<boolean> => {
  const text = String(value || '');
  if (!text) return false;

  try {
    if (window.electron?.copyText) {
      const copied = await window.electron.copyText(text);
      if (copied) return true;
    }
  } catch {
    // fall through to web clipboard
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to textarea fallback
  }

  return fallbackCopyWithTextarea(text);
};

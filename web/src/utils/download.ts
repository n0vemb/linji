/** 保存到手机下载结果 */
export interface DownloadResult {
  success: boolean;
}

/** 触发 <a download> 下载（blob URL 真实下载；其余生成占位文件演示流程） */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 为 mock 占位资源生成占位文本文件（演示保存到手机流程，D4 Deferred 未接对象存储） */
function makePlaceholderBlob(filename: string): string {
  const blob = new Blob(
    [
      `LinJi·灵集 素材占位文件：${filename}\n`,
      '（初版前端原型，未接入真实对象存储，下载为占位演示文件）',
    ],
    { type: 'text/plain' }
  );
  return URL.createObjectURL(blob);
}

/**
 * 保存到手机：视频 / 图片。
 * - blob: 真实本地预览资源 → 直接下载到相册/文件。
 * - mock: 占位资源 → 生成占位文件触发下载，演示完整流程。
 */
export function downloadMedia(
  url: string | null,
  filename: string
): DownloadResult {
  if (!url) return { success: false };
  if (url.startsWith('blob:')) {
    triggerDownload(url, filename);
    return { success: true };
  }
  const placeholder = makePlaceholderBlob(filename);
  triggerDownload(placeholder, filename);
  setTimeout(() => URL.revokeObjectURL(placeholder), 1000);
  return { success: true };
}

/** 图片保存（封面） */
export function downloadImage(
  url: string | null,
  filename: string
): DownloadResult {
  return downloadMedia(url, filename);
}

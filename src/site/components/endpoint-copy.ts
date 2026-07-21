export async function copyEndpoint(endpoint: string, clipboard: Pick<Clipboard, "writeText"> | undefined = navigator.clipboard): Promise<boolean> {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(endpoint);
    return true;
  } catch {
    return false;
  }
}

export function initEndpointCopy(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-endpoint]");
  const endpoint = document.querySelector<HTMLElement>("[data-endpoint]");
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  if (!button || !endpoint || !status) return;

  button.addEventListener("click", async () => {
    const copied = await copyEndpoint(endpoint.textContent?.trim() ?? "");
    if (copied) {
      button.textContent = "已复制 ✓";
      status.textContent = "MCP Endpoint 已复制到剪贴板。";
      window.setTimeout(() => { button.textContent = "复制"; }, 2200);
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(endpoint);
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = "无法自动复制，地址已选中，请手动复制。";
  });
}

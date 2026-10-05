/* ============================================================================
   WWN — кнопки копирования статьи: код в <pre> и «скопировать ссылку».
   Подписи приходят из data-атрибутов (i18n остаётся на сборке).
   Скрипт переживает View Transitions: инициализация на каждом astro:page-load.
   ============================================================================ */

interface CopyLabels {
  copy: string;
  copied: string;
  link: string;
}

function readLabels(): CopyLabels | null {
  const host = document.querySelector<HTMLElement>("[data-copy-labels]");
  if (!host) return null;
  const { copy, copied, copyLinkLabel } = host.dataset;
  return copy && copied && copyLinkLabel ? { copy, copied, link: copyLinkLabel } : null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** «Скопировано» на 1.6 с, затем возврат исходной подписи. */
function flash(button: HTMLButtonElement, doneLabel: string, idleLabel: string): void {
  button.textContent = doneLabel;
  button.classList.add("is-done");
  window.setTimeout(() => {
    button.textContent = idleLabel;
    button.classList.remove("is-done");
  }, 1600);
}

function bind(
  button: HTMLButtonElement,
  labels: CopyLabels,
  getText: () => string,
  idleLabel: string,
): void {
  if (button.dataset.bound === "true") return;
  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    if (!(await copyText(getText()))) return;
    flash(button, labels.copied, idleLabel);
  });
}

function initCopy(): void {
  const labels = readLabels();
  if (!labels) return;

  for (const pre of document.querySelectorAll<HTMLPreElement>(".article__body pre")) {
    const code = pre.querySelector("code");
    if (!code) continue;
    let copyButton = pre.querySelector<HTMLButtonElement>(".article__copy");
    if (!copyButton) {
      copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "article__copy";
      pre.append(copyButton);
    }
    copyButton.textContent = labels.copy;
    bind(copyButton, labels, () => code.textContent ?? "", labels.copy);
  }

  for (const link of document.querySelectorAll<HTMLButtonElement>("[data-copy-link]")) {
    link.textContent = labels.link;
    bind(link, labels, () => window.location.href, labels.link);
  }
}

document.addEventListener("astro:page-load", initCopy);
initCopy();

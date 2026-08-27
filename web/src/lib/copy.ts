/* COPY, AND THE ONE LINE THAT SAYS IT HAPPENED.

   A `mailto:` on this address was a guess about the reader: that they have a
   desktop client bound to the scheme, that it is the client they write from,
   and that they want a blank draft rather than the address. On the machines
   where that guess is wrong -- a browser with no handler, a webmail user, a
   reader who wanted to paste it into the client already open -- the link either
   opens nothing or opens the wrong program, and either way the address they
   came for is now the one thing they cannot have. Copying hands them the
   address itself, which works everywhere and is what they were after.

   THE CONFIRMATION IS A SEPARATE SURFACE BECAUSE THE ACTION LEFT NO TRACE.
   `UndoNotice` in the app deliberately refuses a toast, and the reason it gives
   is exact: a toast floats over the surface it is about, and the reader is
   looking at that surface. Here there is nothing to look at -- the clipboard is
   invisible and the page did not move -- so the report has nowhere in the flow
   to stand and no row it would cover. It obeys the rest of that record's rules:
   the shell's ground plus an icon tile, no coloured edge bar, no tone, and
   `role="status"` so a screen reader announces it at the next pause rather than
   interrupting the reader mid-sentence.

   The fallback is not decoration. `navigator.clipboard` is undefined on any
   page that is not a secure context, and it rejects when the document has no
   focus -- so the offscreen-field path is the one that runs on a plain-HTTP
   preview, and without it the button would fail silently there. */

const GONE = 2600;

/** The offscreen field, for the two cases the async API does not cover. */
function legacy(text: string): boolean {
  const f = document.createElement('textarea');
  f.value = text;
  f.setAttribute('readonly', '');
  /* Not `display:none` and not `hidden`: a field the layout has removed cannot
     hold a selection, and a selection is the whole mechanism here. It is placed
     off the top edge instead, and `position:fixed` keeps it from extending the
     page the way an absolutely positioned one would. */
  f.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none';
  document.body.appendChild(f);
  f.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  f.remove();
  return ok;
}

async function put(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  return legacy(text);
}

export function armCopy(): void {
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  const line = toast?.querySelector<HTMLElement>('[data-toast-text]');
  let timer = 0;

  /* One timer, cleared before it is set. A second copy while the first notice
     is still up has to restart the clock rather than inherit the remainder of
     it, or the reader sees the confirmation for their second press vanish
     almost immediately. */
  const say = (msg: string) => {
    if (!toast || !line) return;
    line.textContent = msg;
    toast.setAttribute('data-on', '');
    clearTimeout(timer);
    timer = window.setTimeout(() => toast.removeAttribute('data-on'), GONE);
  };

  document.querySelectorAll<HTMLElement>('[data-copy]').forEach((el) => {
    el.addEventListener('click', async () => {
      const text = el.dataset.copy!;
      /* WHAT IT SAYS IS WHAT IS ON THE CLIPBOARD. A failed copy that reported
         success would send the reader to paste nothing into a compose window,
         which is worse than the mailto it replaced. */
      say(await put(text) ? `Copied ${text}` : `Could not copy. The address is ${text}`);
    });
  });
}

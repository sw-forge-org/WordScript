export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);

export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  [...r.querySelectorAll<T>(s)];

export const prefersReduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

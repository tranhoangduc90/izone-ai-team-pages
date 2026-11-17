// Capture the position immediately before applying a response, after any user scroll during the request.
export function keepReadingPosition(scroller, region, selector, update, key = node => node) {
  const page = scroller === window;
  if (!(page ? window.scrollY : scroller.scrollTop)) return update();
  const top = page ? 0 : scroller.getBoundingClientRect().top;
  const bottom = page ? window.innerHeight : scroller.getBoundingClientRect().bottom;
  const anchors = [...region.querySelectorAll(selector)].map(node => ({node, rect:node.getBoundingClientRect()}))
    .filter(({rect}) => rect.height && rect.bottom > top && rect.top < bottom)
    .sort((a,b) => Math.abs(a.rect.top-top)-Math.abs(b.rect.top-top))
    .slice(0,4).map(({node,rect}) => ({key:key(node), top:rect.top}));

  update();
  if (!anchors.length) return;
  const positions = new Map([...region.querySelectorAll(selector)].map(node => [key(node), node]));
  for (const anchor of anchors) {
    const node = positions.get(anchor.key);
    if (!node?.getClientRects().length) continue;
    const delta = node.getBoundingClientRect().top-anchor.top;
    if (Math.abs(delta)>1) scroller.scrollBy({top:delta,behavior:'instant'});
    break;
  }
}

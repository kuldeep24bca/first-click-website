/**
 * FAQ accordion — one answer open at a time, keyboard & screen-reader friendly
 */

(function () {
  const items = [...document.querySelectorAll('.faq-item')];

  const setOpen = (item, open) => {
    item.classList.toggle('is-open', open);
    item.querySelector('.faq-q').setAttribute('aria-expanded', String(open));
  };

  items.forEach((item) => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => other !== item && setOpen(other, false));
      setOpen(item, willOpen);
    });
  });
})();

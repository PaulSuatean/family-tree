(function () {
  window.AncestrioTheme?.initThemeToggle({ persistInitialTheme: true });

  const faqItems = Array.from(document.querySelectorAll('.faq-item'));

  function setFaqState(item, isOpen) {
    if (!item) return;
    const toggle = item.querySelector('.faq-toggle');
    const content = item.querySelector('.faq-content');
    if (!toggle || !content) return;

    item.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    content.style.maxHeight = isOpen ? `${content.scrollHeight}px` : '0px';
  }

  faqItems.forEach((item) => {
    const toggle = item.querySelector('.faq-toggle');
    if (!toggle) return;

    setFaqState(item, false);
    toggle.addEventListener('click', () => {
      const shouldOpen = !item.classList.contains('is-open');
      faqItems.forEach((entry) => setFaqState(entry, false));
      setFaqState(item, shouldOpen);
    });
  });

  window.addEventListener('resize', () => {
    faqItems.forEach((item) => {
      if (item.classList.contains('is-open')) {
        setFaqState(item, true);
      }
    });
  });
})();

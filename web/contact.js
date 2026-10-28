// Fills every [data-contact] element with the contact email from config.js,
// or a placeholder while none is set.
(() => {
  const email = (window.PARK_YOURSELF_CONFIG || {}).contactEmail;
  for (const el of document.querySelectorAll('[data-contact]')) {
    if (email) {
      const link = document.createElement('a');
      link.href = `mailto:${email}`;
      link.textContent = email;
      el.replaceChildren(link);
    } else {
      el.textContent = '[contact email to be added]';
    }
  }
})();


// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('[data-nav]');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.style.display === 'block';
    nav.style.display = open ? 'none' : 'block';
    toggle.setAttribute('aria-expanded', String(!open));
  });
}

// Cal.com embed note: the script is globally included via <script defer src="https://embed.cal.com/embed.js"></script>
// The data-cal-link attribute in .cal-embed wrappers should be updated to your actual link.

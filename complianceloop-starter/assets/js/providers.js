document.addEventListener('DOMContentLoaded', async () => {
  const select = document.getElementById('service_areas');
  try {
    const res = await fetch('/assets/data/ct-cities.json');
    const cities = await res.json();
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
  const otherChk = document.getElementById('service_other_chk');
  const otherWrap = document.getElementById('services_other_wrap');
  otherChk.addEventListener('change', () => {
    otherWrap.style.display = otherChk.checked ? 'block' : 'none';
  });
  document.getElementById('provider_form').addEventListener('submit', () => {
    document.getElementById('provider_submitted_at').value = new Date().toISOString();
    document.getElementById('provider_thanks').style.display = 'block';
  });
});

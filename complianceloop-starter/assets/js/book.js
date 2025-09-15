document.addEventListener('DOMContentLoaded', () => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('returning')) {
    document.getElementById('returning-note').style.display = 'block';
    document.getElementById('returning').value = '1';
    document.querySelector('input[name=email]').focus();
  }
  const properties = document.getElementById('properties');
  let propIndex = 1;
  function addProperty() {
    const div = document.createElement('div');
    div.className = 'property';
    div.innerHTML = `<label>Address<input type="text" name="properties[${propIndex}][address]" required></label><label>City<input type="text" name="properties[${propIndex}][city]" required></label>`;
    properties.appendChild(div);
    propIndex++;
  }
  document.getElementById('add_property').addEventListener('click', addProperty);
  if (qs.get('multi')) addProperty();

  const emailInput = document.querySelector('input[name=email]');
  emailInput.addEventListener('blur', async () => {
    if (!emailInput.value) return;
    try {
      const res = await fetch(`/api/lookup?email=${encodeURIComponent(emailInput.value)}`);
      const data = await res.json();
      if (data.found && data.contact) {
        document.querySelector('input[name=full_name]').value = data.contact.full_name || '';
        document.querySelector('input[name=phone]').value = data.contact.phone || '';
        if (data.contact.primary_property) {
          const p = properties.querySelector('.property');
          p.querySelector('input[name="properties[0][address]"]').value = data.contact.primary_property.address || '';
          p.querySelector('input[name="properties[0][city]"]').value = data.contact.primary_property.city || '';
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  document.getElementById('to_step2').addEventListener('click', () => {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    const name = encodeURIComponent(document.querySelector('input[name=full_name]').value);
    const email = encodeURIComponent(emailInput.value);
    document.getElementById('cal_fallback').href = `https://cal.com/complianceloop/compliance-appointment?name=${name}&email=${email}`;
  });

  document.getElementById('to_step3').addEventListener('click', () => {
    const props = [...properties.querySelectorAll('.property')].map((p) => ({
      address: p.querySelector('input[name*="[address]"]').value,
      city: p.querySelector('input[name*="[city]"]').value
    }));
    document.getElementById('properties_json').value = JSON.stringify(props);
    const services = [...document.querySelectorAll('input[name="services[]"]:checked')].map((i) => i.value);
    document.getElementById('services_json').value = JSON.stringify(services);
    document.getElementById('future_service').value = document.querySelector('textarea[name=request_future_service]').value;
    document.getElementById('summary').innerHTML = `<p><strong>${document.querySelector('input[name=full_name]').value}</strong></p>`;
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
    document.getElementById('submitted_at').value = new Date().toISOString();
  });

  document.getElementById('book_form').addEventListener('submit', () => {
    document.getElementById('book_thanks').style.display = 'block';
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.event && e.data.data && e.data.data.startTime) {
      document.getElementById('primary_time').value = e.data.data.startTime;
    }
  });
});

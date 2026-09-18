// ===== CKR FINDS — Carrito de compras + Checkout Wompi / Addi =====

// ===== ADDI — CONFIGURACIÓN =====
const ADDI_ALLY_SLUG = 'ckrboutique-ecommerce';
const CKR_STOCK_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwg9Exn5g-aEe3hpP3-MCHZz-mAUKXYve_FU1Sha7xwSbhLy7B6eWnvf1XrcrF29bs/exec';

let cart = JSON.parse(localStorage.getItem('ckrfinds_cart') || '[]');

function saveCart() {
  localStorage.setItem('ckrfinds_cart', JSON.stringify(cart));
}

function formatPrice(num) {
  return '$' + num.toLocaleString('es-CO') + ' COP';
}

// ---- BADGE ----
function updateCartBadge() {
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ---- TOAST ----
function showToast() {
  const toast = document.getElementById('cartToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---- AGREGAR AL CARRITO ----
function addToCart(name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, qty: 1 });
  }
  saveCart();
  updateCartBadge();
  showToast();
  openCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartItems();
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartItems();
}

// ---- RENDERIZAR ITEMS ----
function renderCartItems() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <p>Tu carrito está vacío</p>
        <p>Agrega algo que sí necesites de verdad.</p>
      </div>`;
    totalEl.textContent = '$0 COP';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map((item, i) => {
    total += item.price * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
        </div>
        <div class="cart-item-controls">
          <button onclick="changeQty(${i}, -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${i}, 1)">+</button>
          <button class="remove-btn" onclick="removeFromCart(${i})" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');

  totalEl.textContent = formatPrice(total);
}

// ---- ABRIR / CERRAR CARRITO ----
function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

// ---- FORMULARIO DE DATOS DEL CLIENTE ----
let _checkoutCallback = null;
let _checkoutRequiereCedula = false;

function showCustomerForm(callback, requiereCedula) {
  _checkoutCallback = callback;
  _checkoutRequiereCedula = !!requiereCedula;
  const cedulaField = document.getElementById('cf-cedula-field');
  if (cedulaField) cedulaField.style.display = _checkoutRequiereCedula ? 'block' : 'none';
  document.getElementById('customerFormModal').style.display = 'flex';
}

function closeCustomerForm() {
  document.getElementById('customerFormModal').style.display = 'none';
  _checkoutCallback = null;
}

function submitCustomerForm() {
  const nombre = document.getElementById('cf-nombre').value.trim();
  const cedulaInput = document.getElementById('cf-cedula');
  const cedula = cedulaInput ? cedulaInput.value.trim() : '';
  const email  = document.getElementById('cf-email').value.trim();
  const tel    = document.getElementById('cf-tel').value.trim();
  const dir    = document.getElementById('cf-dir').value.trim();
  const ciudad = document.getElementById('cf-ciudad').value.trim();
  const depto  = document.getElementById('cf-depto').value.trim();
  if (!nombre || !email || !tel || !dir || !ciudad || !depto) {
    alert('Por favor completa todos los campos para continuar.');
    return;
  }
  if (_checkoutRequiereCedula && !cedula) {
    alert('Para pagar a crédito necesitamos tu número de cédula.');
    return;
  }
  const callback = _checkoutCallback; // guardar antes de cerrar, closeCustomerForm() lo pone en null
  closeCustomerForm();
  if (callback) callback({ nombre, cedula, email, tel, dir, ciudad, depto });
}

// ---- NOTIFICAR PEDIDO POR WHATSAPP (para que CKR haga el pedido manual al proveedor) ----
function notificarPedidoWhatsApp(cliente, total) {
  let msg = '🛍️ *Nuevo pedido CKR Finds*\n\n';
  cart.forEach((item, i) => {
    msg += `${i + 1}. *${item.name}* × ${item.qty}\n   ${formatPrice(item.price * item.qty)}\n`;
  });
  msg += `\n━━━━━━━━━━━━━━━\n*TOTAL: ${formatPrice(total)}*\n\n`;
  msg += `📋 *Cliente:*\n👤 ${cliente.nombre}\n📧 ${cliente.email}\n📞 ${cliente.tel}\n📍 ${cliente.dir}, ${cliente.ciudad}, ${cliente.depto}`;
  return 'https://wa.me/573017604292?text=' + encodeURIComponent(msg);
}

// ---- CHECKOUT CON WOMPI ----
const WOMPI_PUBLIC_KEY = 'pub_prod_q37sErxb7ePerWO5XBkg8EtkaEtNtedu';
const WOMPI_INTEGRITY_SECRET = 'prod_integrity_MIosK6AhGAV4IQsL3Tv05VSEKhKW4fvW';

async function generateIntegrityHash(reference, amountInCents) {
  const data = `${reference}${amountInCents}COP${WOMPI_INTEGRITY_SECRET}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkoutWompi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, email, tel, dir, ciudad, depto }) => {
    iniciarPagoWompi({ nombre, email, tel, dir, ciudad, depto });
  });
}

// ---- CHECKOUT CON ADDI (directo en la página — redirige a Addi a decidir el crédito) ----
function checkoutAddi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, cedula, email, tel, dir, ciudad, depto }) => {
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const pedido = {
      tienda: 'ckrfinds',
      cliente: { nombre, cedula, email, tel, dir, ciudad, depto },
      items: cart.map(i => ({ nombre: i.name, qty: i.qty, precio: i.price })),
      total
    };
    addiIniciarCheckout(pedido);
  }, true); // true = requiere cédula
}

// Llama al backend (Apps Script, compartido con ckrnow.com) para crear la
// transacción en Addi y redirige al cliente a la página de Addi donde decide
// si acepta el crédito. Se usa JSONP (script dinámico) porque las respuestas
// de Apps Script no traen headers CORS legibles desde el navegador.
function addiIniciarCheckout(pedido) {
  const overlay = document.createElement('div');
  overlay.id = 'addi-loading-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;text-align:center;padding:20px;';
  overlay.innerHTML = '<div>⏳ Conectando con Addi...<br><small style="opacity:.8">No cierres esta ventana</small></div>';
  document.body.appendChild(overlay);

  const cbName = 'addiCb_' + Date.now();
  const cleanup = () => {
    const s = document.getElementById(cbName + '_script');
    if (s) s.remove();
    delete window[cbName];
    overlay.remove();
  };

  window[cbName] = function (res) {
    cleanup();
    if (res && res.ok && res.redirectUrl) {
      window.location.href = res.redirectUrl;
    } else {
      alert((res && res.error) || 'No se pudo iniciar el pago con Addi. Intenta de nuevo o elige otro método.');
    }
  };

  const script = document.createElement('script');
  script.id = cbName + '_script';
  script.src = CKR_STOCK_WEBHOOK + '?accion=addi_crear_transaccion'
    + '&callback=' + encodeURIComponent(cbName)
    + '&pedido=' + encodeURIComponent(JSON.stringify(pedido));
  script.onerror = () => { cleanup(); alert('No se pudo conectar con Addi. Revisa tu conexión e intenta de nuevo.'); };
  document.body.appendChild(script);

  // Salvavidas: si Addi/Apps Script no responde en 20s, no dejar al cliente esperando para siempre.
  setTimeout(() => {
    if (window[cbName]) { cleanup(); alert('Addi está tardando demasiado en responder. Intenta de nuevo en un momento.'); }
  }, 20000);
}

// ---- CHECKOUT CON SISTECREDITO ----
function checkoutSistecredito() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, cedula, email, tel, dir, ciudad, depto }) => {
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    sistecreditoIniciarCheckout({
      tienda: 'ckrfinds',
      cliente: { nombre, cedula, email, tel, dir, ciudad, depto },
      items: cart.map(i => ({ nombre: i.name, qty: i.qty, precio: i.price })),
      total
    });
  }, true);
}

function sistecreditoIniciarCheckout(pedido) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;text-align:center;padding:20px;';
  overlay.innerHTML = '<div>⏳ Conectando con Sistecrédito...<br><small style="opacity:.8">No cierres esta ventana</small></div>';
  document.body.appendChild(overlay);

  const cbName = 'sisteCb_' + Date.now();
  const cleanup = () => {
    const s = document.getElementById(cbName + '_script');
    if (s) s.remove();
    delete window[cbName];
    overlay.remove();
  };
  window[cbName] = function (res) {
    cleanup();
    if (res && res.ok && res.redirectUrl) {
      window.location.href = res.redirectUrl;
    } else {
      alert((res && res.error) || 'No se pudo iniciar el pago con Sistecrédito. Intenta de nuevo o elige otro método.');
    }
  };
  const script = document.createElement('script');
  script.id = cbName + '_script';
  script.src = CKR_STOCK_WEBHOOK + '?accion=sistecredito_crear_transaccion'
    + '&callback=' + encodeURIComponent(cbName)
    + '&pedido=' + encodeURIComponent(JSON.stringify(pedido));
  script.onerror = () => { cleanup(); alert('No se pudo conectar con Sistecrédito. Revisa tu conexión e intenta de nuevo.'); };
  document.body.appendChild(script);
  setTimeout(() => {
    if (window[cbName]) { cleanup(); alert('Sistecrédito está tardando demasiado en responder. Intenta de nuevo en un momento.'); }
  }, 45000);
}

// ---- WIDGET DE CUOTAS ADDI EN PRODUCTOS ----
function parsePrice(priceText) {
  return parseInt(priceText.replace(/\./g, '').replace(/\D/g, ''), 10);
}

function injectAddiWidgets() {
  document.querySelectorAll('.product-info').forEach(info => {
    const priceEl = info.querySelector('.product-price');
    if (!priceEl || info.querySelector('addi-widget')) return;
    const price = parsePrice(priceEl.textContent);
    if (!price || price < 100000) return;
    const widget = document.createElement('addi-widget');
    widget.setAttribute('price', String(price));
    widget.setAttribute('ally-slug', ADDI_ALLY_SLUG);
    widget.className = 'addi-cuotas';
    priceEl.insertAdjacentElement('afterend', widget);
  });
}

async function iniciarPagoWompi({ nombre, email, tel, dir, ciudad, depto }) {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const amountInCents = total * 100;
  const reference = 'CKRF-' + Date.now();
  const integrityHash = await generateIntegrityHash(reference, amountInCents);

  localStorage.setItem('ckrfinds_pending_total', total.toString());
  localStorage.setItem('ckrfinds_pending_wa', notificarPedidoWhatsApp({ nombre, email, tel, dir, ciudad, depto }, total));

  const params = new URLSearchParams({
    'public-key': WOMPI_PUBLIC_KEY,
    'currency': 'COP',
    'amount-in-cents': amountInCents,
    'reference': reference,
    'signature:integrity': integrityHash,
    'redirect-url': 'https://ckrfinds.ckrnow.com/?pago=exitoso'
  });

  const form = document.createElement('form');
  form.method = 'GET';
  form.action = 'https://checkout.wompi.co/p/';
  params.forEach((value, key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function closeSuccessModal() {
  document.getElementById('wompiSuccessModal').style.display = 'none';
}

// Detectar retorno desde Wompi con ?pago=exitoso
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('pago') === 'exitoso') {
    const waLink = localStorage.getItem('ckrfinds_pending_wa');
    localStorage.removeItem('ckrfinds_pending_total');
    cart = [];
    saveCart();
    updateCartBadge();
    document.getElementById('wompiSuccessModal').style.display = 'flex';
    if (waLink) {
      const btn = document.getElementById('wompiSuccessWaBtn');
      if (btn) btn.href = waLink;
    }
    localStorage.removeItem('ckrfinds_pending_wa');
    history.replaceState({}, '', '/');
  }
  updateCartBadge();
  injectAddiWidgets();
});

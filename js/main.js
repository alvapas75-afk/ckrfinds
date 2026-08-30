// ===== CKR FINDS — Carrito de compras + Checkout Wompi =====

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
function showCustomerForm() {
  document.getElementById('customerFormModal').style.display = 'flex';
}

function closeCustomerForm() {
  document.getElementById('customerFormModal').style.display = 'none';
}

function submitCustomerForm() {
  const nombre = document.getElementById('cf-nombre').value.trim();
  const email  = document.getElementById('cf-email').value.trim();
  const tel    = document.getElementById('cf-tel').value.trim();
  const dir    = document.getElementById('cf-dir').value.trim();
  const ciudad = document.getElementById('cf-ciudad').value.trim();
  const depto  = document.getElementById('cf-depto').value.trim();
  if (!nombre || !email || !tel || !dir || !ciudad || !depto) {
    alert('Por favor completa todos los campos para continuar.');
    return;
  }
  closeCustomerForm();
  iniciarPagoWompi({ nombre, email, tel, dir, ciudad, depto });
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
  showCustomerForm();
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
});

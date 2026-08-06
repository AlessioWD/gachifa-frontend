const API_BASE_URL = "https://gachifa-backend-production.up.railway.app/api";
const CUSTOMER_TOKEN_KEY = "gachifaCustomerToken";
const CUSTOMER_USER_KEY = "gachifaCustomerUser";
const nomorWA = "62881036505315";
const CART_KEY = "gachifaKeranjang";

function getCustomerToken() {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

function getCustomerUser() {
    try {
        const data = localStorage.getItem(CUSTOMER_USER_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function saveCustomerAuth(token, user) {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

function logoutCustomer() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
}

function updateAccountNav() {
    const label = document.getElementById('nav-account-label');
    const link = document.getElementById('nav-account-item');
    if (!label || !link) return;

    const user = getCustomerUser();
    const anchor = link.querySelector('a');

    if (getCustomerToken() && user) {
        label.textContent = user.name.split(' ')[0];
        if (anchor) anchor.href = 'profile.html';
    } else {
        label.textContent = 'Masuk';
        if (anchor) anchor.href = 'account.html';
    }
}

function getKeranjang() {
    try {
        const data = sessionStorage.getItem(CART_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveKeranjang(keranjang) {
    sessionStorage.setItem(CART_KEY, JSON.stringify(keranjang));
}

function beliRoti(namaRoti, hargaSatuan, qty = 1, satuan = '', productId = null) {
    const keranjang = getKeranjang();
    keranjang.push({ nama: namaRoti, hargaSatuan, qty, satuan, productId });
    saveKeranjang(keranjang);

    updateTampilanKeranjang();
    updateNavBadge();

    const infoJumlah = satuan ? ` (${qty} ${satuan})` : '';
    showToast(namaRoti + infoJumlah + ' ditambahkan ke keranjang');
}

function hapusKeranjang(index) {
    const keranjang = getKeranjang();
    keranjang.splice(index, 1);
    saveKeranjang(keranjang);

    updateTampilanKeranjang();
    updateNavBadge();
}

function formatRupiah(angka) {
    return 'Rp ' + angka.toLocaleString('id-ID');
}

function subtotalItem(item) {
    return item.hargaSatuan * item.qty;
}

function updateNavBadge() {
    const badge = document.getElementById('nav-cart-count');
    if (!badge) return;

    const keranjang = getKeranjang();
    if (keranjang.length > 0) {
        badge.innerText = keranjang.length;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function updateTampilanKeranjang() {
    const keranjangDiv = document.getElementById('keranjang-items');
    const checkoutBtn = document.getElementById('checkout-btn');
    const countEl = document.getElementById('keranjang-count');
    if (!keranjangDiv) return;

    const keranjang = getKeranjang();

    if (countEl) countEl.innerText = keranjang.length + ' item';

    if (keranjang.length === 0) {
        keranjangDiv.innerHTML = '<p style="color: #666;">Keranjang kosong...</p>';
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
    }

    let total = 0;
    let html = '';

    keranjang.forEach((item, index) => {
        const sub = subtotalItem(item);
        total += sub;

        const detailHarga = item.qty > 1
            ? `${formatRupiah(item.hargaSatuan)} x ${item.qty} ${item.satuan} = ${formatRupiah(sub)}`
            : formatRupiah(sub);

        html += `
            <div class="keranjang-item">
                <div>
                    <strong>${item.nama}</strong>
                    <br><small>${detailHarga}</small>
                </div>
                <button onclick="hapusKeranjang(${index})" class="btn-hapus">Hapus</button>
            </div>
        `;
    });

    html += `<div class="keranjang-total">Total: ${formatRupiah(total)}</div>`;
    keranjangDiv.innerHTML = html;

    if (checkoutBtn) checkoutBtn.style.display = 'inline-block';
}

function checkout() {
    const keranjang = getKeranjang();

    if (keranjang.length === 0) {
        alert("Keranjang masih kosong!");
        return;
    }

    const user = getCustomerUser();
    if (user) {
        const nameInput = document.getElementById('customer_name');
        const phoneInput = document.getElementById('customer_phone');
        const addressInput = document.getElementById('customer_address');
        if (nameInput) nameInput.value = user.name || '';
        if (phoneInput) phoneInput.value = user.phone || '';
        if (addressInput) addressInput.value = user.address || '';
    }

    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('checkout-modal-show');
    document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('checkout-modal-show');
    document.body.style.overflow = '';
}

async function confirmCheckout(event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('checkout-form-error');
    const keranjang = getKeranjang();

    if (errorEl) errorEl.style.display = 'none';

    const itemsTanpaId = keranjang.filter(i => !i.productId);
    if (itemsTanpaId.length > 0) {
        if (errorEl) {
            errorEl.textContent = 'Beberapa item di keranjang lama tidak lengkap datanya. Silakan hapus keranjang dan pilih ulang produknya.';
            errorEl.style.display = 'block';
        }
        return;
    }

    const payload = {
        customer_name: form.customer_name.value.trim(),
        customer_phone: form.customer_phone.value.trim(),
        customer_address: form.customer_address.value.trim(),
        items: keranjang.map(item => ({ product_id: item.productId, qty: item.qty })),
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Memproses...';
    }

    try {
        const headers = { 'Content-Type': 'application/json' };
        const customerToken = getCustomerToken();
        if (customerToken) headers['Authorization'] = `Bearer ${customerToken}`;

        const res = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
            const firstError = data.errors ? Object.values(data.errors)[0][0] : (data.message || 'Gagal membuat order.');
            throw new Error(firstError);
        }

        // Order berhasil tersimpan di database, lanjut ke WhatsApp
        let pesan = "Hallo Gachifa Bakery!%0A%0ASaya ingin memesan:%0A%0A";
        let total = 0;

        keranjang.forEach((item) => {
            const sub = subtotalItem(item);
            total += sub;
            const detail = item.qty > 1
                ? `${item.nama} (${item.qty} ${item.satuan} x ${formatRupiah(item.hargaSatuan)}) - ${formatRupiah(sub)}`
                : `${item.nama} - ${formatRupiah(sub)}`;
            pesan += "    •  " + detail + "%0A";
        });

        pesan += "%0ATotal: " + formatRupiah(total) + "%0A%0ANama: " + payload.customer_name + "%0APlease confirm my order.";

        saveKeranjang([]);
        updateTampilanKeranjang();
        updateNavBadge();
        closeCheckoutModal();
        form.reset();

        window.open("https://wa.me/" + nomorWA + "?text=" + pesan, '_blank');
        showToast('Pesanan berhasil dibuat! Status: Pending. Cek progresnya di halaman Cek Status Order.', 4500);
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Konfirmasi & Lanjut ke WhatsApp';
        }
    }
}

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('navOverlay');
    if (!navLinks) return;

    const isOpen = navLinks.classList.toggle('nav-open');
    if (overlay) overlay.classList.toggle('nav-overlay-show', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('navOverlay');
    if (navLinks) navLinks.classList.remove('nav-open');
    if (overlay) overlay.classList.remove('nav-overlay-show');
    document.body.style.overflow = '';
}

function setActiveNavByPage() {
    const navLinks = document.querySelectorAll('.nav-links a');
    let currentPage = window.location.pathname.split('/').pop();
    if (currentPage === '' || currentPage === '/') currentPage = 'index.html';
    let currentKey = currentPage.replace('.html', '');

    // Halaman turunan akun tetap menyalakan menu "Akun/Profil" di nav
    const pageAliases = { profile: 'account', 'track-order': 'account' };
    if (pageAliases[currentKey]) currentKey = pageAliases[currentKey];

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === currentKey) {
            link.classList.add('active');
        }
    });
}

let activeCategory = 'all';

function setCategory(cat, btnEl) {
    activeCategory = cat;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    filterMenu();
}

function filterMenu() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (clearBtn) clearBtn.style.display = searchTerm !== '' ? 'flex' : 'none';

    const cards = document.querySelectorAll('.product-grid .card');
    let visibleCount = 0;

    cards.forEach(card => {
        const cat = card.dataset.category || '';
        const name = card.dataset.name || '';
        const matchCategory = activeCategory === 'all' || cat === activeCategory;
        const matchSearch = searchTerm === '' || name.includes(searchTerm);

        if (matchCategory && matchSearch) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    filterMenu();
}

/* ===== AMBIL PRODUK DARI API (backend Laravel) ===== */

// Gambar default kalau produk belum punya foto di database
const FALLBACK_IMAGE = 'images/logo.png';

function kategoriKeSlug(namaKategori) {
    if (!namaKategori) return 'all';
    const lower = namaKategori.toLowerCase();
    if (lower.includes('tawar')) return 'tawar';
    if (lower.includes('bun')) return 'bun';
    return lower.split(' ')[0];
}

function buatKartuProduk(product) {
    const slug = kategoriKeSlug(product.category ? product.category.name : '');
    const harga = Number(product.price);
    const hargaLabel = `Rp ${harga.toLocaleString('id-ID')}`;
    const gambar = product.image_url || FALLBACK_IMAGE;

    // Badge & isi/min-order sekarang datang langsung dari database (diisi lewat admin),
    // bukan hardcode lagi.
    const badgeHtml = product.badge_label
        ? `<span class="badge ${product.badge_label === 'MIN ORDER' ? 'badge-new' : ''}">${product.badge_label}</span>`
        : '';

    const minOrderHtml = product.min_order_text
        ? `<p class="min-order">⚠️ ${product.min_order_text}</p>`
        : (product.isi_text ? `<p class="min-order">📦 ${product.isi_text}</p>` : '');

    // Qty yang otomatis masuk ke keranjang saat "Beli Sekarang" diklik.
    // Ambil dari min_order_qty (angka di database); kalau kosong/0, default 1.
    const qtyOtomatis = Number(product.min_order_qty) > 0 ? Number(product.min_order_qty) : 1;
    const satuanOtomatis = qtyOtomatis > 1 ? 'pcs' : '';

    return `
        <div class="card reveal-child" data-category="${slug}" data-name="${product.name.toLowerCase()}">
            ${badgeHtml}
            <img src="${gambar}" alt="${product.name}">
            <div class="card-body">
                <h3>${product.name}</h3>
                <p>${product.description || ''}</p>
                ${minOrderHtml}
                <div class="price">${hargaLabel}</div>
                <button class="btn-buy" onclick="beliRoti('${product.name}', ${harga}, ${qtyOtomatis}, '${satuanOtomatis}', ${product.id})">Beli Sekarang</button>
            </div>
        </div>
    `;
}

async function renderProductsFromApi() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    try {
        const res = await fetch(`${API_BASE_URL}/products`);
        if (!res.ok) throw new Error('Gagal memuat produk');
        const products = await res.json();

        const noResultsHtml = '<p id="no-results" class="no-results" style="display:none;">Tidak ada roti yang cocok dengan pencarianmu.</p>';
        grid.innerHTML = noResultsHtml + products.map(buatKartuProduk).join('');
        filterMenu();
    } catch (err) {
        grid.innerHTML = '<p style="color:#c0392b;">Gagal memuat menu. Pastikan server backend (php artisan serve) sedang berjalan.</p>';
        console.error(err);
    }
}

/* ===== KIRIM FORM KONTAK KE API ===== */
async function submitContactForm(event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('contact-form-status');

    const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        message: form.message.value.trim(),
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Mengirim...';
    }
    if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.className = 'contact-form-status';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
            const firstError = data.errors ? Object.values(data.errors)[0][0] : (data.message || 'Terjadi kesalahan, coba lagi.');
            throw new Error(firstError);
        }

        if (statusEl) {
            statusEl.innerText = data.message || 'Pesan berhasil dikirim!';
            statusEl.classList.add('contact-form-success');
            statusEl.style.display = 'block';
        }
        form.reset();
    } catch (err) {
        if (statusEl) {
            statusEl.innerText = err.message || 'Gagal mengirim pesan. Coba lagi nanti.';
            statusEl.classList.add('contact-form-error');
            statusEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Kirim Pesan';
        }
    }
}

let toastTimeout;

function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('toast-show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-show');
    }, duration);
}

/* ===== SCROLL REVEAL ANIMATION ===== */
function initScrollReveal() {
    const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!revealEls.length) return;

    if (!('IntersectionObserver' in window)) {
        revealEls.forEach(el => el.classList.add('revealed'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -60px 0px'
    });

    revealEls.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', function() {
    setActiveNavByPage();
    updateNavBadge();
    updateTampilanKeranjang();
    initScrollReveal();
    updateAccountNav();
});

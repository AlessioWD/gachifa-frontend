const API_BASE_URL = "https://gachifa-backend-production.up.railway.app/api";
const CUSTOMER_TOKEN_KEY = "gachifaCustomerToken";
const CUSTOMER_USER_KEY = "gachifaCustomerUser";
const nomorWA = "62881036505315";
const CART_KEY = "gachifaKeranjang";

// Supaya refresh halaman selalu balik ke posisi paling atas, bukan "ingat" posisi scroll terakhir
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));

// Beberapa browser (termasuk Samsung Internet dengan mode privasi/anti-tracking
// aktif) memblokir localStorage. Supaya pelanggan tetap bisa login & belanja di
// browser seperti itu, dipakai bertingkat: localStorage -> sessionStorage ->
// variabel di memori (hilang kalau tab ditutup, tapi minimal tetap bisa dipakai
// selama tab masih terbuka).
let inMemoryCustomerToken = null;
let inMemoryCustomerUser = null;

function getCustomerToken() {
    try {
        const fromLocal = localStorage.getItem(CUSTOMER_TOKEN_KEY);
        if (fromLocal) return fromLocal;
    } catch (e) {
        console.error('localStorage tidak bisa diakses:', e);
    }
    try {
        const fromSession = sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
        if (fromSession) return fromSession;
    } catch (e) {
        console.error('sessionStorage tidak bisa diakses:', e);
    }
    return inMemoryCustomerToken;
}

function getCustomerUser() {
    try {
        const data = localStorage.getItem(CUSTOMER_USER_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error('localStorage tidak bisa diakses:', e);
    }
    try {
        const data = sessionStorage.getItem(CUSTOMER_USER_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error('sessionStorage tidak bisa diakses:', e);
    }
    return inMemoryCustomerUser;
}

// Mengembalikan true kalau berhasil disimpan permanen (localStorage/sessionStorage),
// false kalau browser blokir keduanya (tapi login tetap dilanjutkan pakai memori,
// supaya pelanggan tidak macet gara-gara ini).
function saveCustomerAuth(token, user) {
    inMemoryCustomerToken = token;
    inMemoryCustomerUser = user;
    let saved = false;
    try {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
        saved = true;
    } catch (e) {
        console.error('Gagal menyimpan sesi login ke localStorage (mungkin diblokir):', e);
    }
    try {
        sessionStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        sessionStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
        saved = true;
    } catch (e) {
        console.error('Gagal menyimpan sesi login ke sessionStorage (mungkin diblokir):', e);
    }
    return saved;
}

function logoutCustomer() {
    inMemoryCustomerToken = null;
    inMemoryCustomerUser = null;
    try {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
    } catch (e) {
        console.error('localStorage tidak bisa diakses:', e);
    }
    try {
        sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
        sessionStorage.removeItem(CUSTOMER_USER_KEY);
    } catch (e) {
        console.error('sessionStorage tidak bisa diakses:', e);
    }
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

// Keranjang di memori sebagai cadangan kalau sessionStorage diblokir, supaya
// tombol "Beli" tidak error total dan keranjang tetap jalan selama tab dibuka.
let inMemoryKeranjang = [];

function getKeranjang() {
    try {
        const data = sessionStorage.getItem(CART_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error('sessionStorage tidak bisa diakses, pakai keranjang di memori:', e);
    }
    return inMemoryKeranjang;
}

function saveKeranjang(keranjang) {
    inMemoryKeranjang = keranjang;
    try {
        sessionStorage.setItem(CART_KEY, JSON.stringify(keranjang));
    } catch (e) {
        console.error('Gagal menyimpan keranjang ke sessionStorage (mungkin diblokir):', e);
    }
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

function hapusSemuaKeranjang() {
    const keranjang = getKeranjang();
    if (keranjang.length === 0) return;

    showConfirmModal({
        onConfirm: function() {
            saveKeranjang([]);
            updateTampilanKeranjang();
            updateNavBadge();
            showToast('Keranjang dikosongkan');
        }
    });
}

function showConfirmModal(options) {
    const overlay = document.getElementById('confirm-modal');
    const okBtn = document.getElementById('confirm-modal-ok');
    if (!overlay || !okBtn) return;

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener('click', function() {
        closeConfirmModal();
        if (options.onConfirm) options.onConfirm();
    });

    overlay.classList.add('confirm-modal-show');
    document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
    const overlay = document.getElementById('confirm-modal');
    if (overlay) overlay.classList.remove('confirm-modal-show');
    document.body.style.overflow = '';
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
    const clearBtn = document.getElementById('clear-cart-btn');
    if (!keranjangDiv) return;

    const keranjang = getKeranjang();

    if (countEl) countEl.innerText = keranjang.length + ' item';

    if (keranjang.length === 0) {
        keranjangDiv.innerHTML = '<p style="color: #666;">Keranjang kosong...</p>';
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    if (clearBtn) clearBtn.style.display = 'inline-flex';

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
        showToast('Keranjang masih kosong!', 2500, 'warning');
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
let visibleLimit = 8;
const LOAD_STEP = 8;
let daftarKategori = [];

async function muatDeskripsiKategori() {
    try {
        const res = await fetch(`${API_BASE_URL}/categories`);
        if (!res.ok) return;
        daftarKategori = await res.json();
    } catch (err) {
        console.error(err);
    }
}

function tampilkanDeskripsiKategori(cat) {
    const el = document.getElementById('category-desc');
    if (!el) return;

    if (cat === 'all') {
        el.style.display = 'none';
        return;
    }

    const kategori = daftarKategori.find(k => kategoriKeSlug(k.name) === cat);
    if (kategori && kategori.description) {
        el.textContent = kategori.description;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function setCategory(cat, btnEl) {
    activeCategory = cat;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    tampilkanDeskripsiKategori(cat);
    filterMenu();
}

function filterMenu(resetPaging = true) {
    if (resetPaging) visibleLimit = 8;

    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (clearBtn) clearBtn.style.display = searchTerm !== '' ? 'flex' : 'none';

    const cards = document.querySelectorAll('.product-grid .card');
    const isFiltering = searchTerm !== '' || activeCategory !== 'all';
    let matchedCount = 0;
    let shownCount = 0;

    cards.forEach(card => {
        const cat = card.dataset.category || '';
        const name = card.dataset.name || '';
        const matchCategory = activeCategory === 'all' || cat === activeCategory;
        const matchSearch = searchTerm === '' || name.includes(searchTerm);
        const isMatch = matchCategory && matchSearch;

        if (!isMatch) {
            card.style.display = 'none';
            return;
        }

        matchedCount++;

        if (isFiltering || matchedCount <= visibleLimit) {
            card.style.display = '';
            shownCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = matchedCount === 0 ? 'block' : 'none';

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        if (isFiltering || matchedCount <= 8) {
            // Tidak sedang filter/search dan produk sedikit -> sembunyikan tombol
            loadMoreBtn.style.display = 'none';
        } else if (matchedCount > shownCount) {
            // Masih ada produk yang belum ditampilkan
            loadMoreBtn.style.display = 'inline-flex';
            loadMoreBtn.textContent = 'Muat Lebih Banyak';
        } else {
            // Semua produk sudah tampil -> beri opsi untuk mengecilkan lagi
            loadMoreBtn.style.display = 'inline-flex';
            loadMoreBtn.textContent = 'Tampilkan Lebih Sedikit';
        }
    }
}

function toggleLoadMore() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    const isShowingLess = loadMoreBtn && loadMoreBtn.textContent.trim() === 'Tampilkan Lebih Sedikit';

    if (isShowingLess) {
        visibleLimit = 8;
        filterMenu(false);
        const grid = document.getElementById('product-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        visibleLimit += LOAD_STEP;
        filterMenu(false);
    }
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
        ? `<div class="min-order-wrap"><p class="min-order">⚠️ ${product.min_order_text}</p></div>`
        : (product.isi_text ? `<div class="min-order-wrap"><p class="min-order">📦 ${product.isi_text}</p></div>` : '<div class="min-order-wrap"><p class="min-order min-order-empty">&nbsp;</p></div>');

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

function showToast(message, duration = 2500, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('toast-warning');
    if (type === 'warning') toast.classList.add('toast-warning');
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

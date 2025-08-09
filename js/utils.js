// --- YARDIMCI FONKSİYONLAR ---

/**
 * API isteklerine otomatik olarak Firebase Auth token'ını ekleyen bir fetch sarmalayıcı (wrapper).
 * @param {string} url - İstek yapılacak URL.
 * @param {object} options - fetch fonksiyonu için standart seçenekler objesi.
 * @returns {Promise<Response>} - fetch'ten dönen Response objesi.
 */
async function fetchWithAuth(url, options = {}) {
    const user = firebase.auth().currentUser;
    if (!user) {
        showNotification('Oturumunuz sonlanmış. Lütfen tekrar giriş yapın.', 'error');
        // İsteğe bağlı: kullanıcıyı giriş sayfasına yönlendir
        // handleLogout(); 
        throw new Error('Kullanıcı oturumu bulunamadı.');
    }

    try {
        const token = await user.getIdToken();

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };

        // Body bir FormData nesnesi değilse Content-Type ekle
        if (!(options.body instanceof FormData) && options.body) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (response.status === 401 || response.status === 403) {
            showNotification('Yetkilendirme hatası. Oturumunuz zaman aşımına uğramış olabilir.', 'error');
            // handleLogout();
        }

        return response;
    } catch (error) {
        console.error('fetchWithAuth hatası:', error);
        showNotification('Bir ağ hatası oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
        throw error;
    }
}


function showNotification(message, type) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = message;
    el.className = `alert alert-${type === 'error' ? 'danger' : 'success'}`;
    el.style.display = 'block';
    setTimeout(() => {
        if(el) el.style.display = 'none';
    }, 5000);
}

async function getAddressFromCoords(coords) {
    if (!coords) return null;
    try {
        const [lat, lng] = coords.split(',');
        const geocodingService = platform.getSearchService(); // 'platform' global olarak varsayılıyor
        const result = await geocodingService.reverseGeocode({
            at: `${lat},${lng}`,
            lang: 'de-DE'
        });
        return result.items.length > 0 ? result.items[0].address.label : coords;
    } catch (error) {
        console.error('Adres dönüştürme hatası:', error);
        return coords;
    }
}
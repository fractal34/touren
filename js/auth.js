// --- YARDIMCI FONKSİYONLAR ---
function showNotification(message, type) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `alert alert-${type === 'error' ? 'danger' : 'success'}`;
    el.style.display = 'block';
}

// --- GÖRÜNÜM YÖNETİMİ (GİRİŞ/KAYIT) ---
async function loadAuthViews() {
    loginContainer = document.getElementById('login-container');
    loginViewWrapper = document.getElementById('login-view-wrapper');
    appContainer = document.getElementById('app-container');

    try {
        const loginRes = await fetch('partials/login.html');

        if (!loginRes.ok) throw new Error('Login view yüklenemedi.');

        loginViewWrapper.innerHTML = await loginRes.text();

        // Olay dinleyicilerini burada bağla
        document.getElementById('login-button').addEventListener('click', handleLogin);
        document.getElementById('show-register-link').addEventListener('click', showRegisterView);

    } catch (error) {
        console.error('Kimlik doğrulama görünümleri yüklenirken hata:', error);
        loginContainer.innerHTML = '<p class="text-danger text-center">Giriş bölümü yüklenemedi. Lütfen sayfayı yenileyin.</p>';
    }
}

async function showLoginView(e) {
    if(e) e.preventDefault();
    try {
        const loginRes = await fetch('partials/login.html');
        if (!loginRes.ok) throw new Error('Login view yüklenemedi.');
        loginViewWrapper.innerHTML = await loginRes.text();
        document.getElementById('login-button').addEventListener('click', handleLogin);
        document.getElementById('show-register-link').addEventListener('click', showRegisterView);
    } catch (error) {
        console.error('Giriş görünümü yüklenirken hata:', error);
        loginViewWrapper.innerHTML = '<p class="text-danger text-center">Giriş bölümü yüklenemedi. Lütfen sayfayı yenileyin.</p>';
    }
}

async function showRegisterView(e) {
    e.preventDefault();
    try {
        const registerRes = await fetch('partials/register.html');
        if (!registerRes.ok) throw new Error('Register view yüklenemedi.');
        loginViewWrapper.innerHTML = await registerRes.text();
        document.getElementById('register-form').addEventListener('submit', handleRegister);
        document.getElementById('show-login-link').addEventListener('click', showLoginView);
    } catch (error) {
        console.error('Kayıt görünümü yüklenirken hata:', error);
        loginViewWrapper.innerHTML = '<p class="text-danger text-center">Kayıt bölümü yüklenemedi. Lütfen sayfayı yenileyin.</p>';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const name = document.getElementById('register-name').value;
    const password = document.getElementById('register-password').value;

    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });

        const token = await userCredential.user.getIdToken();
        const response = await fetch('http://localhost:3000/api/auth/create-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: name })
        });

        if (!response.ok) {
            throw new Error('Profil sunucuya kaydedilemedi.');
        }

        alert('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
        showLoginView();

    } catch (error) {
        alert(`Kayıt hatası: ${error.message}`);
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const token = await userCredential.user.getIdToken();

        const response = await fetch('http://localhost:3000/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (response.ok) {
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            await initializeApp();

            document.getElementById('welcome-message').textContent = `Hoş geldiniz, ${data.user.name}`;
            document.getElementById('logout-button').addEventListener('click', handleLogout);

        } else {
            loginError.textContent = data.message || 'Sunucu doğrulaması başarısız.';
        }

    } catch (error) {
        loginError.textContent = error.message;
    }
}

function handleLogout() {
    firebase.auth().signOut().then(() => {
        window.location.reload();
    }).catch((error) => {
        console.error('Çıkış yaparken hata oluştu', error);
        alert('Çıkış yapılamadı. Lütfen tekrar deneyin.');
    });
}

// --- UYGULAMA BAŞLATMA ---
async function initializeApp() {
    try {
        const response = await fetch('partials/app.html');
        if (!response.ok) throw new Error('App container yüklenemedi.');
        appContainer = document.getElementById('app-container');
        appContainer.innerHTML = await response.text();
        appContainer.style.display = 'flex';

        document.getElementById('route-creation-form-content').classList.add('d-none');
        document.getElementById('initial-route-view').classList.remove('d-none');

        const settingsResponse = await fetch('partials/settings.html');
        if (!settingsResponse.ok) throw new Error('Settings view yüklenemedi.');

        document.getElementById('pane-controls').insertAdjacentHTML('beforeend', await settingsResponse.text());

        Split(['#pane-controls', '#pane-map', '#pane-pallets'], {
            sizes: [20, 50, 30],
            minSize: [500, 100, 700],
            maxSize: [Infinity, Infinity, Infinity],
            gutterSize: 8,
            cursor: 'col-resize',
            onDragEnd: () => {
                if (map) map.getViewPort().resize();
            }
        });

        map = new H.Map(
            document.getElementById('map'),
            defaultLayers.vector.normal.map,
            { zoom: 6, center: { lat: 51.1657, lng: 10.4515 } }
        );
        const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
        ui = H.ui.UI.createDefault(map, defaultLayers);

        await loadInitialData();
        // addEventListeners çağrısı buradan kaldırıldı
    } catch (error) {
        console.error('App container yüklenirken hata:', error);
        showNotification('Uygulama arayüzü yüklenemedi.', 'error');
    }
}

// ... (diğer fonksiyonlar aynı kalacak)

// --- OLAY DİNLEYİCİLERİNİ EKLEME ---
function addEventListeners() {
    // Üst Menü Butonları
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('show-driver-management-button').addEventListener('click', showDriverManagementView);
    document.getElementById('show-market-management-button').addEventListener('click', showMarketManagementView);
    document.getElementById('show-tour-archive-button').addEventListener('click', showTourArchiveView);
    document.getElementById('show-all-routes-button').addEventListener('click', showTourArchiveView);
    document.getElementById('show-settings-button').addEventListener('click', showSettingsView);

    // Ana Panel ve Form Butonları
    document.getElementById('back-to-main-button').addEventListener('click', showMainPanelView);
    document.getElementById('back-to-pallet-loader-button').addEventListener('click', showPalletLoaderView);
    document.getElementById('back-to-market-list-button').addEventListener('click', showMarketListView);
    document.getElementById('start-route-creation-button').addEventListener('click', showRouteCreationFormContent);
    document.getElementById('back-to-initial-view-button').addEventListener('click', hideRouteCreationFormContent);
    document.getElementById('new-route-button').addEventListener('click', resetRouteCreationFormContent);

    // Rota Oluşturma Formu Elemanları
    document.getElementById('city-search').addEventListener('input', handleCitySearch);
    document.getElementById('market-name-search').addEventListener('input', handleMarketNameSearch);
    document.getElementById('add-selected-markets-button').addEventListener('click', handleAddSelectedMarkets);
    document.getElementById('routeButton').addEventListener('click', handleCreateOrUpdateRoute);

    // Şoför Yönetimi
    document.getElementById('add-driver-form').addEventListener('submit', handleAddDriver);
    

    // Market Yönetimi
    document.getElementById('add-new-market-button').addEventListener('click', handleAddNewMarketClick);
    
    

    // Özel Alan Yönetimi
    document.getElementById('add-global-custom-field-button').addEventListener('click', handleAddCustomField);
    document.getElementById('show-global-field-management-button').addEventListener('click', showCustomFieldManagementSection);
    document.getElementById('hide-global-field-management-button').addEventListener('click', hideCustomFieldManagementSection);

    // Diğer
    document.getElementById('print-tour-plan-button').addEventListener('click', () => window.print());

    // Tur Önizleme Navigasyon Butonları
    const prevButton = document.getElementById('prev-tour-button');
    const nextButton = document.getElementById('next-tour-button');

    if (prevButton) {
        prevButton.addEventListener('click', () => navigateToTour(-1));
        console.log('Prev button event listener added.');
    } else {
        console.log('Prev button not found.');
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => navigateToTour(1));
        console.log('Next button event listener added.');
    } else {
        console.log('Next button not found.');
    }
}

// ... (diğer fonksiyonlar aynı kalacak)

async function handleAuthStateChange(user) {
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');

    if (user) {
        console.log("Oturum aktif, uygulama başlatılıyor...");
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        
        try {
            const token = await user.getIdToken();
            // DÜZELTME: Bu çağrı standart fetch olmalı ve token'ı header'da göndermeli
            const response = await fetch('http://localhost:3000/api/auth/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Oturum doğrulaması başarısız.');

            await initializeApp();
            document.getElementById('welcome-message').textContent = `Hoş geldiniz, ${data.user.name}`;
            
            addEventListeners(); // Tüm HTML yüklendikten sonra olay dinleyicilerini bağla

        } catch (error) {
            console.error("Oturum doğrulama hatası:", error); // Hata mesajını konsolda göster
            // DÜZELTME: Hata durumunda otomatik çıkış yapmayı (sayfa yenilemeyi) geçici olarak devre dışı bırak
            // handleLogout(); 
        }

    } else {
        console.log("Oturum yok, giriş ekranı gösteriliyor...");
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        loadAuthViews();
    }
}

function showSettingsView() {
    hideAllControlPanels();
    const settingsView = document.getElementById('settings-view');
    if(settingsView) {
        settingsView.classList.remove('d-none');
        settingsView.style.display = 'block';
    }

    const user = firebase.auth().currentUser;
    if (user) {
        document.getElementById('settings-email').value = user.email || '';
        document.getElementById('settings-name').value = user.displayName || '';
    }

    document.getElementById('back-from-settings-button').addEventListener('click', showMainPanelView);
    document.getElementById('save-settings-button').addEventListener('click', handleSaveSettings);
}

async function handleSaveSettings() {
    const newName = document.getElementById('settings-name').value;
    const user = firebase.auth().currentUser;
    const settingsNotification = document.getElementById('settings-notification');
    settingsNotification.style.display = 'none';

    if (!user) {
        settingsNotification.textContent = 'Kullanıcı oturumu bulunamadı.';
        settingsNotification.className = 'alert alert-danger';
        settingsNotification.style.display = 'block';
        return;
    }

    try {
        if (user.displayName !== newName) {
            await user.updateProfile({
                displayName: newName
            });
        }

        const token = await user.getIdToken();
        const response = await fetch('http://localhost:3000/api/auth/update-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newName })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Profil Firestore\'da güncellenemedi.');
        }

        settingsNotification.textContent = 'Ayarlar başarıyla kaydedildi!';
        settingsNotification.className = 'alert alert-success';
        settingsNotification.style.display = 'block';

        document.getElementById('welcome-message').textContent = `Hoş geldiniz, ${newName}`;

        showMainPanelView();

    } catch (error) {
        console.error('Ayarları kaydederken hata:', error);
        settingsNotification.textContent = `Ayarları kaydederken hata oluştu: ${error.message}`;
        settingsNotification.className = 'alert alert-danger';
        settingsNotification.style.display = 'block';
    }
}

// --- UYGULAMA BAŞLANGIÇ NOKTASI ---
async function fetchConfigAndInitialize() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Yapılandırma dosyası yüklenemedi.');
        }
        const config = await response.json();
        HERE_API_KEY = config.hereApiKey;

        // Firebase'i yapılandır ve başlat
        const firebaseConfig = {
            apiKey: config.firebaseApiKey, // Sunucudan gelen Firebase API anahtarını kullan
            authDomain: "rota1-d40e4.firebaseapp.com",
            projectId: "rota1-d40e4",
            storageBucket: "rota1-d40e4.firebasestorage.app",
            messagingSenderId: "573584179179",
            appId: "1:573584179179:web:ed48ed845d09d35fa1a3ae"
        };
        firebase.initializeApp(firebaseConfig);

        // HERE Platform'u başlat
        platform = new H.service.Platform({ apikey: HERE_API_KEY });
        defaultLayers = platform.createDefaultLayers();

        // Kimlik doğrulama durumunu dinle
        firebase.auth().onAuthStateChanged(handleAuthStateChange);

    } catch (error) {
        console.error("Başlatma hatası:", error);
        document.body.innerHTML = '<p class="text-danger text-center">Uygulama başlatılamadı. Lütfen daha sonra tekrar deneyin.</p>';
    }
}

async function handleAuthStateChange(user) {
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');

    if (user) {
        console.log("Oturum aktif, uygulama başlatılıyor...");
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        
        try {
            const token = await user.getIdToken();
            const response = await fetch('http://localhost:3000/api/auth/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Oturum doğrulaması başarısız.');

            await initializeApp();
            document.getElementById('welcome-message').textContent = `Hoş geldiniz, ${data.user.name}`;
            
            // NİHAİ DÜZELTME: Olay dinleyicilerini, tarayıcının DOM'u tamamen işlemesine izin vermek için
            // bir sonraki "tick"te çalışacak şekilde setTimeout içine al.
            setTimeout(() => {
                addEventListeners();
            }, 0);

        } catch (error) {
            console.error("Oturum doğrulama hatası:", error);
            handleLogout(); 
        }

    } else {
        console.log("Oturum yok, giriş ekranı gösteriliyor...");
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        loadAuthViews();
    }
}

document.addEventListener('DOMContentLoaded', fetchConfigAndInitialize);

let allMarkets = [];
let allDrivers = [];
let allCities = [];
let allRoutes = []; // Yeni: Tüm rotaları saklamak için

// UI ve Uygulama Durumu ile İlgili Global Değişkenler
let HERE_API_KEY;
let platform;
let defaultLayers;
let map = null;
let ui = null;
let marketEditorMap = null;
let marketEditorMarker = null;
let selectedRouteMarkets = [];
let sortable = null;
let sortableTourPlan = null;
let currentEditingDriverId = null;
let loginContainer, loginViewWrapper, appContainer;
let currentEditingRouteId = null;
let globalCustomFields = [];

// --- VERİ YÜKLEME FONKSİYONLARI ---

async function loadInitialData() {
    try {
        // Tüm başlangıç verilerini paralel olarak yükle
        const [marketsRes, driversRes, citiesRes, routesRes, customFieldsRes] = await Promise.all([
            fetchWithAuth('/api/markets'),
            fetchWithAuth('/api/drivers'),
            fetchWithAuth('/api/markets/cities'),
            fetchWithAuth('/api/routing/routes'),
            fetchWithAuth('/api/custom-fields')
        ]);

        if (!marketsRes.ok) throw new Error('Marketler yüklenemedi.');
        if (!driversRes.ok) throw new Error('Sürücüler yüklenemedi.');
        if (!citiesRes.ok) throw new Error('Şehirler yüklenemedi.');
        if (!routesRes.ok) throw new Error('Rotalar yüklenemedi.');
        if (!customFieldsRes.ok) throw new Error('Özel alanlar yüklenemedi.');

        allMarkets = await marketsRes.json();
        allDrivers = await driversRes.json();
        allCities = await citiesRes.json();
        allRoutes = await routesRes.json();
        globalCustomFields = await customFieldsRes.json();

        // Veriler yüklendikten sonra UI elemanlarını doldur
        populateDriverSelect();
        renderSavedRoutes();

        // Olay dinleyicilerini kur
        const driverSelect = document.getElementById('driver-select');
        if (driverSelect && !driverSelect.dataset.listenerAttached) {
            driverSelect.addEventListener('change', handleDriverSelectionChange);
            driverSelect.dataset.listenerAttached = 'true';
        }

        console.log("Tüm başlangıç verileri başarıyla yüklendi.");

    } catch (error) {
        console.error("Başlangıç verileri yüklenirken bir hata oluştu:", error);
        showNotification("Veriler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.", "error");
    }
}

function populateDriverSelect() {
    const driverSelect = document.getElementById('driver-select');
    if (!driverSelect) return;

    const currentDriverId = driverSelect.value;
    driverSelect.innerHTML = '<option value="">Şoför seçilmedi</option>';
    allDrivers.forEach(driver => {
        driverSelect.add(new Option(`${driver.name} - ${driver.licensePlate}`, driver.id));
    });
    driverSelect.value = currentDriverId;
}

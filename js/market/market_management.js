// --- MARKET YÖNETİMİ FONKSİYONLARI ---

function handleCitySearchInput(event) {
    const input = event.target.value.toLowerCase();
    const suggestionsContainer = document.getElementById('city-suggestions-list');
    suggestionsContainer.innerHTML = '';

    if (input.length === 0) {
        return;
    }

    const filteredCities = allCities.filter(city => city.toLowerCase().startsWith(input));
    
    filteredCities.forEach(city => {
        const suggestionDiv = document.createElement('a');
        suggestionDiv.href = '#';
        suggestionDiv.className = 'list-group-item list-group-item-action';
        suggestionDiv.textContent = city;
        suggestionDiv.onclick = (e) => {
            e.preventDefault();
            document.getElementById('market-list-by-city-input').value = city;
            suggestionsContainer.innerHTML = '';
            handleListMarketsByCity();
        };
        suggestionsContainer.appendChild(suggestionDiv);
    });
}

function showMarketSearchArea() {
    const searchArea = document.getElementById('market-search-area');
    const isVisible = searchArea.style.display === 'block';
    searchArea.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        document.getElementById('market-management-search-input').value = '';
        document.getElementById('market-list-by-city-input').value = '';
        document.getElementById('city-suggestions-list').innerHTML = '';
        document.getElementById('market-management-list').innerHTML = ''; 
    }
}

function handleListMarketsByCity() {
    const city = document.getElementById('market-list-by-city-input').value.trim().toLowerCase();
    if (!city) {
        renderMarketsForManagement(allMarkets); // Şehir boşsa tüm marketleri göster
        return;
    }
    const filteredMarkets = allMarkets.filter(market => market.addressDetails.city.toLowerCase() === city);
    renderMarketsForManagement(filteredMarkets);
}

function renderMarketsForManagement(marketsToRender) {
    const marketListContainer = document.getElementById('market-management-list');
    const latestMarketsContainer = document.getElementById('latest-markets-list');
    marketListContainer.innerHTML = ''; // Mevcut marketler listesini boşalt
    latestMarketsContainer.innerHTML = ''; // Son eklenen marketler listesini boşalt

    if (marketsToRender.length === 0) {
        marketListContainer.innerHTML = '<li class="list-group-item text-muted">Gösterilecek market bulunamadı.</li>';
        latestMarketsContainer.innerHTML = '<li class="list-group-item text-muted">Henüz market eklenmedi.</li>';
        return;
    }

    // Marketleri oluşturulma tarihine göre sırala (en yeniden en eskiye)
    const sortedMarkets = [...allMarkets].sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt._seconds * 1000 + a.createdAt._nanoseconds / 1000000) : 0;
        const dateB = b.createdAt ? (b.createdAt._seconds * 1000 + b.createdAt._nanoseconds / 1000000) : 0;
        return dateB - dateA;
    });

    // Son eklenen 10 marketi latestMarketsContainer'a render et
    const latest10Markets = sortedMarkets.slice(0, 10);
    if (latest10Markets.length > 0) {
        latest10Markets.forEach(market => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>
                    <strong>${market.name}</strong> <small class="text-muted">(${market.addressDetails.city})</small><br>
                    <small class="text-muted">${market.addressDetails.street} ${market.addressDetails.number || ''}, ${market.addressDetails.zip} ${market.addressDetails.city}</small>
                </span>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary edit-market-btn" data-id="${market.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-market-btn" data-id="${market.id}"><i class="bi bi-trash"></i></button>
                </div>
            `;
            li.querySelector('.edit-market-btn').addEventListener('click', () => populateMarketEditor(market));
            li.querySelector('.delete-market-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteMarket(market.id);
            });
            latestMarketsContainer.appendChild(li);
        });
    } else {
        latestMarketsContainer.innerHTML = '<li class="list-group-item text-muted">Henüz market eklenmedi.</li>';
    }

    // Arama sonuçlarını veya tüm marketleri (eğer arama yapılmamışsa) marketListContainer'a render et
    // Bu kısım, arama yapıldığında veya şehir filtresi uygulandığında çalışacak.
    // Başlangıçta bu liste boş kalacak, sadece arama yapıldığında dolacak.
    if (marketsToRender !== allMarkets) { // Eğer marketsToRender, allMarkets'in kendisi değilse (yani bir filtreleme/arama sonucuysa)
        if (marketsToRender.length === 0) {
            marketListContainer.innerHTML = '<li class="list-group-item text-muted">Arama/filtreleme sonucunda market bulunamadı.</li>';
        } else {
            marketsToRender.forEach(market => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>
                        <strong>${market.name}</strong> <small class="text-muted">(${market.addressDetails.city})</small><br>
                        <small class="text-muted">${market.addressDetails.street} ${market.addressDetails.number || ''}, ${market.addressDetails.zip} ${market.addressDetails.city}</small>
                    </span>
                    <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary edit-market-btn" data-id="${market.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-market-btn" data-id="${market.id}"><i class="bi bi-trash"></i></button>
                </div>
                `;
                li.querySelector('.edit-market-btn').addEventListener('click', () => populateMarketEditor(market));
            li.querySelector('.delete-market-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteMarket(market.id);
            });
                marketListContainer.appendChild(li);
            });
        }
    }
}

function handleMarketManagementSearch() {
    const searchTerm = document.getElementById('market-management-search-input').value.toLowerCase();
    const marketListContainer = document.getElementById('market-management-list');
    marketListContainer.innerHTML = '';

    if (searchTerm.length < 2) {
        renderMarketsForManagement(allMarkets); // Arama terimi kısaysa tüm marketleri göster
        return;
    }

    const searchResults = allMarkets.filter(market => 
        market.name.toLowerCase().includes(searchTerm) || 
        market.addressDetails.city.toLowerCase().includes(searchTerm)
    );

    renderMarketsForManagement(searchResults);
}

async function handleAddNewMarketClick() {
    currentEditingMarketId = null;
    const newMarketTemplate = { id: null, name: '', customerNumber: '', addressDetails: {}, notes: '', specialNotes: '', customFieldValues: {} };
    document.getElementById('market-editor-title').textContent = 'Yeni Market Ekle';
    await populateMarketEditor(newMarketTemplate);
    document.getElementById('delete-market-button').style.display = 'none';
}

async function handleSaveMarket() {
    const customFieldValues = {};
    document.querySelectorAll('#market-editor-custom-fields-container .form-control[data-field-id]').forEach(input => {
        customFieldValues[input.dataset.fieldId] = input.value;
    });

    const marketData = {
        name: document.getElementById('market-editor-name').value,
        customerNumber: document.getElementById('market-editor-customer-number').value,
        address: {
            street: document.getElementById('market-editor-street').value,
            number: document.getElementById('market-editor-street-number').value, // ID düzeltildi
            zip: document.getElementById('market-editor-zip').value,
            city: document.getElementById('market-editor-city').value,
            country: document.getElementById('market-editor-country').value || 'Almanya'
        },
        coordinates: {
            lat: parseFloat(document.getElementById('market-editor-form').dataset.lat) || null,
            lng: parseFloat(document.getElementById('market-editor-form').dataset.lng) || null
        },
        notes: document.getElementById('market-editor-notes').value,
        specialNotes: document.getElementById('market-editor-special-notes').value,
        euroPalletKg: parseInt(document.getElementById('market-editor-euro-pallet-kg').value, 10) || 0,
        widePalletKg: parseInt(document.getElementById('market-editor-wide-pallet-kg').value, 10) || 0,
        customFieldValues: customFieldValues
    };

    const url = currentEditingMarketId 
        ? `http://localhost:3000/api/markets/${currentEditingMarketId}` 
        : 'http://localhost:3000/api/markets';
    const method = currentEditingMarketId ? 'PUT' : 'POST';

    try {
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(marketData)
        });

        const savedMarket = await response.json();
        if (!response.ok) {
            throw new Error(savedMarket.message || `Market ${method === 'POST' ? 'eklenemedi' : 'güncellenemedi'}.`);
        }
        showNotification(`Market başarıyla kaydedildi!`, 'success');
        await loadInitialData(); // Tüm verileri yeniden yükle
        showMarketListView();
        renderMarketsForManagement(allMarkets); // Listeyi güncel verilerle yeniden çiz
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteMarket(marketId) {
    if (!marketId) return;

    if (confirm('Bu marketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
        try {
            const response = await fetchWithAuth(`http://localhost:3000/api/markets/${marketId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Market silinemedi.');
            
            showNotification('Market başarıyla silindi.', 'success');
            await loadInitialData();
            showMarketListView();
            renderMarketsForManagement(allMarkets);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

function showMarketManagementView() {
    hideRightPanelViews();  
    document.getElementById('market-management-view').classList.remove('d-none');
    showMarketListView();
    console.log("showMarketManagementView çağrıldı. allMarkets:", allMarkets);
    renderMarketsForManagement(allMarkets);
    // Olay dinleyicilerini ata
    const cityInput = document.getElementById('market-list-by-city-input');
    if (cityInput && !cityInput.dataset.listenerAttached) {
        cityInput.addEventListener('input', handleCitySearchInput);
        cityInput.dataset.listenerAttached = 'true';
    }
    const searchInput = document.getElementById('market-management-search-input');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.addEventListener('input', handleMarketManagementSearch);
        searchInput.dataset.listenerAttached = 'true';
    }

    // Excel yükleme olay dinleyicisi
    const uploadButton = document.getElementById('upload-excel-button');
    if (uploadButton && !uploadButton.dataset.listenerAttached) {
        uploadButton.addEventListener('click', handleExcelUpload);
        uploadButton.dataset.listenerAttached = 'true';
    }

    // Market Bul butonu olay dinleyicisi
    const showMarketSearchBtn = document.getElementById('show-market-search-button');
    if (showMarketSearchBtn && !showMarketSearchBtn.dataset.listenerAttached) {
        showMarketSearchBtn.addEventListener('click', showMarketSearchArea);
        showMarketSearchBtn.dataset.listenerAttached = 'true';
    }

    // Excel'den İçe Aktar butonu olay dinleyicisi
    const showExcelUploadBtn = document.getElementById('show-excel-upload-button');
    if (showExcelUploadBtn && !showExcelUploadBtn.dataset.listenerAttached) {
        showExcelUploadBtn.addEventListener('click', toggleExcelUploadArea);
        showExcelUploadBtn.dataset.listenerAttached = 'true';
    }
}

function toggleExcelUploadArea() {
    const excelUploadArea = document.getElementById('excel-upload-area');
    const isVisible = excelUploadArea.style.display === 'block';
    excelUploadArea.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        // Alan açıldığında mesajı temizle
        const messageDiv = document.getElementById('excel-upload-message');
        messageDiv.innerHTML = '';
        messageDiv.classList.remove('alert', 'alert-success', 'alert-danger', 'alert-info');
        document.getElementById('excel-upload-input').value = ''; // Dosya seçimini temizle
    }
}

function handleListMarketsByCity() {
    console.log("handleListMarketsByCity tetiklendi.");
    const city = document.getElementById('market-list-by-city-input').value.trim().toLowerCase();
    if (!city) {
        renderMarketsForManagement(allMarkets); // Şehir boşsa tüm marketleri göster
        return;
    }
    const filteredMarkets = allMarkets.filter(market => market.addressDetails.city.toLowerCase() === city);
    renderMarketsForManagement(filteredMarkets);
}

function handleMarketManagementSearch() {
    console.log("handleMarketManagementSearch tetiklendi.");
    const searchTerm = document.getElementById('market-management-search-input').value.toLowerCase();
    const marketListContainer = document.getElementById('market-management-list');
    marketListContainer.innerHTML = '';

    if (searchTerm.length < 2) {
        renderMarketsForManagement(allMarkets); // Arama terimi kısaysa tüm marketleri göster
        return;
    }

    const searchResults = allMarkets.filter(market => 
        market.name.toLowerCase().includes(searchTerm) || 
        market.addressDetails.city.toLowerCase().includes(searchTerm)
    );

    renderMarketsForManagement(searchResults);
}

async function handleExcelUpload() {
    const fileInput = document.getElementById('excel-upload-input');
    const messageDiv = document.getElementById('excel-upload-message');
    messageDiv.innerHTML = '';
    messageDiv.classList.remove('alert', 'alert-success', 'alert-danger');

    if (fileInput.files.length === 0) {
        messageDiv.classList.add('alert', 'alert-danger');
        messageDiv.textContent = 'Lütfen yüklenecek bir dosya seçin.';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('excelFile', file);

    try {
        messageDiv.classList.add('alert', 'alert-info');
        messageDiv.textContent = 'Dosya yükleniyor ve işleniyor...';

        const response = await fetchWithAuth('http://localhost:3000/api/markets/upload-excel', {
            method: 'POST',
            body: formData,
            // Content-Type başlığı FormData ile otomatik olarak ayarlanır
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.classList.remove('alert-info', 'alert-danger');
            messageDiv.classList.add('alert', 'alert-success');
            messageDiv.textContent = result.summary || 'Dosya başarıyla yüklendi.';
            await loadInitialData(); // Marketleri yeniden yükle
            renderMarketsForManagement(allMarkets); // Listeyi güncelle
        } else {
            messageDiv.classList.remove('alert-info', 'alert-success');
            messageDiv.classList.add('alert', 'alert-danger');
            messageDiv.textContent = result.message || 'Dosya yüklenirken bir hata oluştu.';
            console.error('Excel yükleme hatası:', result);
        }
    } catch (error) {
        messageDiv.classList.remove('alert-info', 'alert-success');
        messageDiv.classList.add('alert', 'alert-danger');
        messageDiv.textContent = `Yükleme sırasında bir ağ hatası oluştu: ${error.message}`;
        console.error('Excel yükleme sırasında ağ hatası:', error);
    }
}

function showMarketListView() {
    document.getElementById('market-list-view').classList.remove('d-none');
    document.getElementById('market-editor-view').classList.add('d-none');
}
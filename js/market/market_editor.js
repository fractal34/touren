// --- MARKET DÜZENLEYİCİ VE HARİTA ENTEGRASYONU FONKSİYONLARI ---

async function populateMarketEditor(market) {
    currentEditingMarketId = market.id;
    document.getElementById('market-editor-title').textContent = 'Market Düzenle';
    document.getElementById('market-editor-form').reset();

    showMarketEditorView(); 

    document.getElementById('market-editor-name').value = market.name || '';
    document.getElementById('market-editor-customer-number').value = market.customerNumber || '';
    
    if (!marketEditorMap) {
        marketEditorMap = new H.Map(
            document.getElementById('market-editor-map'),
            defaultLayers.vector.normal.map,
            { zoom: 6, center: { lat: 51.1657, lng: 10.4515 } }
        );
        new H.mapevents.Behavior(new H.mapevents.MapEvents(marketEditorMap));
        marketEditorMap.addEventListener('tap', handleMapTap);
        marketEditorMap.getViewPort().resize();
    } else {
        marketEditorMap.removeObjects(marketEditorMap.getObjects());
        marketEditorMarker = null;
        marketEditorMap.setCenter({ lat: 51.1657, lng: 10.4515 });
        marketEditorMap.setZoom(6);
        marketEditorMap.getViewPort().resize();
    }

    if (market.addressDetails) {
        document.getElementById('market-editor-street').value = market.addressDetails.street || '';
        document.getElementById('market-editor-street-number').value = market.addressDetails.number || '';
        document.getElementById('market-editor-zip').value = market.addressDetails.zip || '';
        document.getElementById('market-editor-city').value = market.addressDetails.city || '';
        if (market.coordinates && market.coordinates.lat && market.coordinates.lng) {
            const position = { lat: market.coordinates.lat, lng: market.coordinates.lng };
            addMarketEditorMarker(position);
            marketEditorMap.setCenter(position);
            marketEditorMap.setZoom(14);
        }
    } else if (market.address) {
        const addressRegex = /^(.+?)(?:\s+([\d\w-]+))?,\s*(\d{5})\s+(.+)$/;
        const match = market.address.match(addressRegex);
        if (match) {
            document.getElementById('market-editor-street').value = match[1] ? match[1].trim() : '';
            document.getElementById('market-editor-street-number').value = match[2] || '';
            document.getElementById('market-editor-zip').value = match[3] || '';
            document.getElementById('market-editor-city').value = match[4] ? match[4].trim() : '';
        } else {
            document.getElementById('market-editor-street').value = market.address || '';
        }
    } 

    document.getElementById('market-editor-notes').value = market.notes || '';
    document.getElementById('market-editor-special-notes').value = market.specialNotes || '';
    // document.getElementById('market-editor-total-kg').value = market.totalKg || 0;

    const customFieldsContainer = document.getElementById('market-editor-custom-fields-container');
    customFieldsContainer.innerHTML = '';
    globalCustomFields.forEach(field => {
        const value = market.customFieldValues ? (market.customFieldValues[field.fieldId] || '') : '';
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'mb-2';
        fieldDiv.innerHTML = `
            <label class="form-label">${field.label}</label>
            <input type="text" class="form-control custom-field-input" data-field-id="${field.fieldId}" value="${value}">
        `;
        customFieldsContainer.appendChild(fieldDiv);
    });

    const globalFieldsList = document.getElementById('global-custom-fields-list');
    globalFieldsList.innerHTML = '';
    globalCustomFields.forEach(field => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.dataset.fieldId = field.fieldId;

        const span = document.createElement('span');
        span.className = 'field-label';
        span.textContent = field.label;

        const div = document.createElement('div');

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-sm btn-outline-primary edit-global-field-btn me-2';
        editButton.dataset.id = field.id;
        editButton.dataset.label = field.label;
        editButton.textContent = 'Düzenle';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-sm btn-outline-danger delete-global-field-btn';
        deleteButton.dataset.id = field.id;
        deleteButton.textContent = 'Sil';

        div.appendChild(editButton);
        div.appendChild(deleteButton);

        li.appendChild(span);
        li.appendChild(div);
        globalFieldsList.appendChild(li);
    });

    globalFieldsList.querySelectorAll('.edit-global-field-btn').forEach(button => {
        button.addEventListener('click', handleEditGlobalCustomField);
    });
    globalFieldsList.querySelectorAll('.delete-global-field-btn').forEach(button => {
        button.addEventListener('click', handleDeleteGlobalCustomField);
    });

    document.getElementById('delete-market-button').style.display = 'inline-block';
    showMarketEditorView();

    document.getElementById('market-editor-search-button').addEventListener('click', handleMarketEditorAddressSearch);
    document.getElementById('market-editor-address-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleMarketEditorAddressSearch();
        }
    });
}

function addMarketEditorMarker(position) {
    if (marketEditorMarker) {
        marketEditorMap.removeObject(marketEditorMarker);
    }
    marketEditorMarker = new H.map.Marker(position);
    marketEditorMap.addObject(marketEditorMarker);
}

async function handleMarketEditorAddressSearch() {
    const searchTerm = document.getElementById('market-editor-address-search').value.trim();
    const searchResultsContainer = document.getElementById('market-editor-search-results');
    searchResultsContainer.innerHTML = '';

    if (!searchTerm) {
        showNotification('Lütfen bir adres veya yer adı girin.', 'error');
        return;
    }

    if (searchTerm.length < 3) {
        showNotification('Lütfen en az 3 karakter girin.', 'error');
        return;
    }

    console.log('Searching for:', searchTerm);

    try {
        const geocodingService = platform.getSearchService();
        const result = await geocodingService.geocode({
            q: searchTerm,
            in: 'countryCode:DEU'
        });

        if (result.items.length > 0) {
            result.items.forEach(item => {
                const li = document.createElement('a');
                li.href = '#';
                li.className = 'list-group-item list-group-item-action';
                li.textContent = item.address.label;
                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    selectMarketEditorAddress(item);
                });
                searchResultsContainer.appendChild(li);
            });
        } else {
            searchResultsContainer.innerHTML = '<div class="list-group-item">Sonuç bulunamadı.</div>';
            document.getElementById('add-selected-address-to-form-button').classList.add('d-none');
        }
    } catch (error) {
        console.error('Adres arama sırasında hata oluştu:', error);
        if (error.response) {
            try {
                const errorText = await error.response.text();
                console.error('API Response Error Text:', errorText);
            } catch (e) {
                console.error('API Response Text okunamadı:', e);
            }
        }
        showNotification('Adres arama sırasında bir hata oluştu.', 'error');
    }
}

async function handleMapTap(evt) {
    if (!marketEditorMap) return;
    const coord = marketEditorMap.get('screenToGeo')(evt.currentPointer.viewportX, evt.currentPointer.viewportY);
    try {
        const geocodingService = platform.getSearchService();
        const result = await geocodingService.reverseGeocode({
            at: `${coord.lat},${coord.lng}`,
            lang: 'de-DE'
        });

        if (result.items.length > 0) {
            selectMarketEditorAddress(result.items[0]);
        } else {
            showNotification('Bu konum için adres bulunamadı.', 'info');
            document.getElementById('add-selected-address-to-form-button').classList.add('d-none');
        }
    } catch (error) {
        console.error('Ters coğrafi kodlama hatası:', error);
        showNotification('Konum bilgisi alınırken bir hata oluştu.', 'error');
    }
}

function selectMarketEditorAddress(item) {
    const address = item.address;
    const form = document.getElementById('market-editor-form');

    form.dataset.selectedStreet = address.street || '';
    form.dataset.selectedStreetNumber = address.houseNumber || '';
    form.dataset.selectedZip = address.postalCode || '';
    form.dataset.selectedCity = address.city || '';
    form.dataset.selectedLat = item.position.lat;
    form.dataset.selectedLng = item.position.lng;
    form.dataset.selectedName = item.title || '';

    const addButton = document.getElementById('add-selected-address-to-form-button');
    addButton.classList.remove('d-none');
    if (!addButton.dataset.listenerAdded) {
        addButton.addEventListener('click', () => {
            document.getElementById('market-editor-name').value = form.dataset.selectedName;
            document.getElementById('market-editor-street').value = form.dataset.selectedStreet;
            document.getElementById('market-editor-street-number').value = form.dataset.selectedStreetNumber;
            document.getElementById('market-editor-zip').value = form.dataset.selectedZip;
            document.getElementById('market-editor-city').value = form.dataset.selectedCity;
            form.dataset.lat = form.dataset.selectedLat;
            form.dataset.lng = form.dataset.selectedLng;

            addMarketEditorMarker(item.position);
            marketEditorMap.setCenter(item.position);
            marketEditorMap.setZoom(14);
            addButton.classList.add('d-none');
            document.getElementById('market-editor-search-results').innerHTML = '';
        });
        addButton.dataset.listenerAdded = 'true';
    }

    addMarketEditorMarker(item.position);
    marketEditorMap.setCenter(item.position);
    marketEditorMap.setZoom(14);
}

function showMarketEditorView() {
    document.getElementById('market-list-view').classList.add('d-none');
    document.getElementById('market-editor-view').classList.remove('d-none');

    const deleteButton = document.getElementById('delete-market-button');
    if (deleteButton) {
        deleteButton.onclick = () => {
            if (currentEditingMarketId) {
                handleDeleteMarket(currentEditingMarketId);
            }
        }; // Mevcut olay dinleyicisini değiştirir
    }

    const saveButton = document.getElementById('save-market-button');
    if (saveButton) {
        saveButton.onclick = handleSaveMarket; // Mevcut olay dinleyicisini değiştirir
    }
}

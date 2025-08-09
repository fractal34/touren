// --- ROTA OLUŞTURMA FORMU VE MARKET LİSTESİ İLE İLGİLİ UI ETKİLEŞİMLERİ ---

function populateStartEndLocations() {
    const startSelect = document.getElementById('start');
    const endSelect = document.getElementById('end');
    const locations = [
        { text: "Willy-Brandt-Straße 1, Berlin", value: "52.5186,13.3761" },
        { text: "Rathausmarkt 1, Hamburg", value: "53.5504,9.9925" },
        { text: "Marienplatz 1, München", value: "48.1371,11.5753" },
        { text: "Domkloster 4, Köln", value: "50.9413,6.9583" },
        { text: "Römerberg 23, Frankfurt", value: "50.1109,8.6821" }
    ];
    locations.forEach(loc => {
        startSelect.add(new Option(loc.text, loc.value));
        endSelect.add(new Option(loc.text, loc.value));
    });
}

function displayFilteredMarkets(filtered) {
    const container = document.getElementById('city-based-markets');
    container.innerHTML = filtered.map(market => {
        const isSelected = selectedRouteMarkets.some(m => m.id === market.id);
        return `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${market.id}" id="market-${market.id}" ${isSelected ? 'disabled checked' : ''}>
                <label class="form-check-label" for="market-${market.id}">${market.name} (${market.address})</label>
            </div>`;
    }).join('');
}

function handleCitySearch(e) {
    const input = e.target.value.toLowerCase();
    const suggestionsContainer = document.getElementById('city-search-suggestions');
    suggestionsContainer.innerHTML = '';

    document.getElementById('market-name-search').value = '';
    document.getElementById('city-based-markets').innerHTML = '';

    if (input.length === 0) {
        return;
    }

    console.log("handleCitySearch: allMarkets içeriği:", allMarkets);

    const filteredCities = allCities.filter(city => city.toLowerCase().startsWith(input));
    
    filteredCities.forEach(city => {
        const suggestionDiv = document.createElement('a');
        suggestionDiv.href = '#';
        suggestionDiv.className = 'list-group-item list-group-item-action';
        suggestionDiv.textContent = city;
        suggestionDiv.onclick = (event) => {
            event.preventDefault();
            document.getElementById('city-search').value = city;
            suggestionsContainer.innerHTML = '';
            const marketsForCity = allMarkets.filter(m => m.addressDetails && m.addressDetails.city.toLowerCase() === city.toLowerCase());
            console.log(`handleCitySearch: '${city}' şehri için filtrelenen marketler:`, marketsForCity);
            displayFilteredMarkets(marketsForCity);
        };
        suggestionsContainer.appendChild(suggestionDiv);
    });
}

function handleMarketNameSearch(e) {
    document.getElementById('city-search').value = '';
    const term = e.target.value.toLowerCase();
    displayFilteredMarkets(term ? allMarkets.filter(m => m.name.toLowerCase().includes(term)) : []);
}

function handleAddSelectedMarkets() {
    document.querySelectorAll('#city-based-markets .form-check-input:checked:not(:disabled)').forEach(box => {
        const market = allMarkets.find(m => m.id === box.value);
        if (market) {
            selectedRouteMarkets.push({ ...market, euroPallets: 0, widePallets: 0 });
        }
    });
    renderFinalMarketList();
    document.getElementById('city-search').value = '';
    document.getElementById('market-name-search').value = '';
    displayFilteredMarkets([]);
}

function renderFinalMarketList() {
    const container = document.getElementById('final-market-list');
    container.innerHTML = '';
    selectedRouteMarkets.forEach((market, index) => {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        item.dataset.id = market.id;
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="d-flex align-items-center flex-grow-1">
                    <i class="bi bi-grip-vertical text-muted me-2" style="cursor: grab;"></i>
                    <div class="flex-grow-1">
                        <strong>${index + 1}. ${market.name}</strong>
                        <small class="d-block text-muted">${market.address}</small>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-danger remove-final-market-btn" data-id="${market.id}"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="row gx-2 align-items-center">
                <div class="col-6">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text" title="Euro Palet">E</span>
                        <input type="number" class="form-control pallet-input" data-id="${market.id}" data-type="euroPallets" value="${market.euroPallets || 0}" min="0">
                    </div>
                </div>
                <div class="col-6">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text" title="Geniş Palet">G</span>
                        <input type="number" class="form-control pallet-input" data-id="${market.id}" data-type="widePallets" value="${market.widePallets || 0}" min="0">
                    </div>
                </div>
            </div>
            <div class="row gx-2 align-items-center mt-1">
                <div class="col-12">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text">Toplam Kg</span>
                        <input type="number" class="form-control pallet-input" data-id="${market.id}" data-type="totalKg" value="${market.totalKg || 0}" min="0">
                        <span class="input-group-text">kg</span>
                    </div>
                </div>
            </div>`;
        container.appendChild(item);
    });
    addFinalListListeners();
    updateTotals();
    activateSorting();
}

function addFinalListListeners() {
    document.querySelectorAll('.pallet-input').forEach(i => i.addEventListener('change', handlePalletChange));
    document.querySelectorAll('.remove-final-market-btn').forEach(b => b.addEventListener('click', handleRemoveFinalMarket));
}

function handlePalletChange(e) {
    const market = selectedRouteMarkets.find(m => m.id === e.target.dataset.id);
    if(market) {
        const value = parseInt(e.target.value, 10) || 0;
        if (e.target.dataset.type === 'euroPallets') {
            market.euroPallets = value;
        } else if (e.target.dataset.type === 'widePallets') {
            market.widePallets = value;
        } else if (e.target.dataset.type === 'totalKg') {
            market.totalKg = value;
        }
    }
    updateTotals();
}

function handleRemoveFinalMarket(e) {
    selectedRouteMarkets = selectedRouteMarkets.filter(m => m.id !== e.currentTarget.dataset.id);
    renderFinalMarketList();
}

function updateTotals() {
    const driverId = document.getElementById('driver-select').value;
    const selectedDriver = allDrivers.find(d => d.id === driverId);

    const weightInput = document.getElementById('weight');
    const palletCapacityInput = document.getElementById('truck-pallet-capacity');

    // Şoför seçimine göre tonaj ve palet kapasitesini ayarla
    if (selectedDriver) {
        if (weightInput.value !== selectedDriver.maxPallets) {
            weightInput.value = selectedDriver.maxPallets || 0;
        }
        if (palletCapacityInput.value !== selectedDriver.palletCapacity) {
            palletCapacityInput.value = selectedDriver.palletCapacity || 0;
        }
    } else {
        // Şoför seçili değilse veya bulunamazsa varsayılan değerler
        weightInput.value = 0;
        palletCapacityInput.value = 0;
    }

    const maxWeight = parseInt(weightInput.value, 10) || 0;
    const totals = selectedRouteMarkets.reduce((acc, m) => {
        acc.euroPallets += m.euroPallets || 0;
        acc.widePallets += m.widePallets || 0;
        acc.totalKg += m.totalKg || 0;
        return acc;
    }, { euroPallets: 0, widePallets: 0, totalKg: 0 });

    const totalWeight = totals.totalKg;
    
    const totalWeightEl = document.getElementById('total-weight');
    totalWeightEl.textContent = totalWeight.toLocaleString();
    
    if (maxWeight > 0 && totalWeight > maxWeight) {
        totalWeightEl.className = 'fw-bold text-danger';
    } else {
        totalWeightEl.className = 'fw-bold text-success';
    }

    const truckCapacity = parseInt(palletCapacityInput.value, 10) || 0;
    const usedCapacity = (totals.widePallets * 2) + totals.euroPallets;
    const percentage = truckCapacity > 0 ? (usedCapacity / truckCapacity) * 100 : 0;

    const progressBar = document.getElementById('capacity-progress-bar');
    const capacityText = document.getElementById('capacity-text');

    progressBar.style.width = `${Math.min(percentage, 100)}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
    progressBar.setAttribute('aria-valuenow', percentage);

    progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
    if (percentage > 100) {
        progressBar.classList.add('bg-danger');
    } else if (percentage > 85) {
        progressBar.classList.add('bg-warning');
    } else {
        progressBar.classList.add('bg-success');
    }

    capacityText.textContent = `Kullanılan Alan: ${usedCapacity} / ${truckCapacity}`;
}

function activateSorting() {
    const list = document.getElementById('final-market-list');
    if (sortable) sortable.destroy();
    sortable = new Sortable(list, {
        animation: 150,
        ghostClass: 'bg-info-subtle',
        onEnd: (evt) => {
            const item = selectedRouteMarkets.splice(evt.oldIndex, 1)[0];
            selectedRouteMarkets.splice(evt.newIndex, 0, item);
            renderFinalMarketList();
        }
    });
}

function resetRouteCreationFormContent() {
    document.getElementById('route-name').value = '';
    document.getElementById('driver-select').value = '';
    document.getElementById('city-search').value = '';
    document.getElementById('market-name-search').value = '';
    document.getElementById('city-based-markets').innerHTML = '';
    document.getElementById('final-market-list').innerHTML = '';
    
    document.getElementById('weight').value = 0;
    document.getElementById('total-pallets').innerHTML = '0';
    document.getElementById('total-euro-kg').textContent = '0';
    document.getElementById('total-wide-kg').textContent = '0';
    document.getElementById('total-weight').textContent = '0';
    document.getElementById('distance').textContent = '--';
    document.getElementById('travel-time').textContent = '--';
    document.getElementById('capacity-progress-bar').style.width = '0%';
    document.getElementById('capacity-progress-bar').textContent = '0%';
    document.getElementById('capacity-progress-bar').className = 'progress-bar bg-success';
    document.getElementById('capacity-text').textContent = 'Kullanılan Alan: 0 / 0';
    
    selectedRouteMarkets = [];
    if (map) {
        map.removeObjects(map.getObjects());
    }
    
    updateTotals();

    const routeButton = document.getElementById('routeButton');
    routeButton.textContent = 'Rota Oluştur';
    routeButton.removeEventListener('click', handleCreateOrUpdateRoute);
    routeButton.removeEventListener('click', handleCreateOrUpdateRoute);

    currentEditingRouteId = null;
    showNotification('Yeni rota oluşturma paneli hazır.', 'info');
}

// --- TUR ARŞİVİ İŞLEMLERİ ---

let currentPreviewRouteId = null;
let currentPreviewRouteIndex = -1;
let currentFilteredRoutes = []; // O anki filtrelenmiş veya tüm rotaları tutacak

function showTourArchiveView() {
    hideAllControlPanels();
    document.getElementById('tour-archive-view').classList.remove('d-none');
    document.getElementById('back-to-main-from-archive-button').addEventListener('click', showMainPanelView);
    
    document.getElementById('back-to-archive-main-view-button').addEventListener('click', showArchiveMainView);

    showArchiveMainView();
    renderSavedRoutes(); // Rotaları yükledikten sonra render et

    flatpickr("#archive-calendar-container", {
        inline: true,
        dateFormat: "d.m.Y",
        onChange: function(selectedDates, dateStr, instance) {
            const selectedDate = selectedDates[0];
            const archiveList = document.getElementById('archive-routes-list');
            archiveList.innerHTML = '';

            if (!selectedDate) return;

            const filteredRoutes = allRoutes.filter(route => {
                const routeDate = new Date(route.createdAt);
                return routeDate.getFullYear() === selectedDate.getFullYear() &&
                       routeDate.getMonth() === selectedDate.getMonth() &&
                       routeDate.getDate() === selectedDate.getDate();
            });
            
            currentFilteredRoutes = filteredRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Tarihe göre sırala
            
            if (currentFilteredRoutes.length === 0) {
                archiveList.innerHTML = '<p class="text-muted text-center">Seçilen tarih için tur bulunamadı.</p>';
            } else {
                currentFilteredRoutes.forEach(route => archiveList.appendChild(createRouteListItem(route, true)));
            }
        }
    });
}

async function showRouteInPreview(routeId) {
    try {
        const response = await fetchWithAuth(`http://localhost:3000/api/routing/routes/${routeId}`);
        if (!response.ok) {
            throw new Error('Rota bilgileri yüklenemedi.');
        }
        const routeData = await response.json();

        document.getElementById('preview-route-name').textContent = routeData.routeName;
        
        const selectedDriver = allDrivers.find(d => d.id === routeData.driverId);
        const driverName = selectedDriver ? `${selectedDriver.name} ${selectedDriver.plate}` : '--';

        document.getElementById('preview-tour-plan-date').innerHTML = `<strong>Tarih:</strong> ${new Date(routeData.createdAt).toLocaleDateString('de-DE')}`;
        document.getElementById('preview-tour-plan-driver').innerHTML = `<strong>Şoför:</strong> ${driverName}`;

        const tableBody = document.getElementById('preview-tour-plan-table-body');
        tableBody.innerHTML = '';

        let totalPallets = 0;
        let totalKg = 0;

        const stops = routeData.stops.filter(wp => wp.id !== 'start' && wp.id !== 'end');

        const previewMarkets = stops.map(stop => {
            const market = allMarkets.find(m => m.id === stop.id);
            return { 
                ...market, 
                euroPallets: stop.euroPallets || 0,
                widePallets: stop.widePallets || 0,
                totalKg: stop.totalKg || 0,
            };
        }).filter(Boolean);

        previewMarkets.forEach((market, index) => {
            const pallets = (market.euroPallets || 0) + (market.widePallets || 0);
            const kg = market.totalKg || 0;
            totalPallets += pallets;
            totalKg += kg;

            const row = `
                <tr>
                    <td class="tour-plan-index-col">${index + 1}</td>
                    <td>${market.customerNumber || ''}</td>
                    <td class="text-start">
                        <strong>${market.name}</strong><br>
                        <small>${market.addressDetails.city}</small>
                    </td>
                    <td>
                        <table class="inner-pallet-table">
                            <tr>
                                <th>E</th>
                                <th>G</th>
                            </tr>
                            <tr>
                                <td>${market.euroPallets || 0}</td>
                                <td>${market.widePallets || ''}</td>
                            </tr>
                        </table>
                    </td>
                    <td>${kg}</td>
                    <td>${market.notes || ''}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        const specialNotesContentDiv = document.getElementById('preview-special-notes-content');
        specialNotesContentDiv.innerHTML = '';

        const marketsWithSpecialNotes = stops.map(stop => allMarkets.find(m => m.id === stop.id)).filter(m => m && m.specialNotes && m.specialNotes.trim() !== '');

        if (marketsWithSpecialNotes.length > 0) {
            marketsWithSpecialNotes.forEach(market => {
                const p = document.createElement('p');
                p.className = 'mb-1';
                p.innerHTML = `<strong>${market.customerNumber || '--'} - ${market.name}:</strong> ${market.specialNotes}`;
                specialNotesContentDiv.appendChild(p);
            });
        } else {
            specialNotesContentDiv.innerHTML = '<p class="text-muted mb-0">Özel durum bulunmamaktadır.</p>';
        }

        document.getElementById('preview-tour-plan-total-pallets').textContent = totalPallets;
        document.getElementById('preview-tour-plan-total-kg').textContent = totalKg.toLocaleString();

        const tourPreviewModalElement = document.getElementById('tourPreviewModal');
        const tourPreviewModal = new bootstrap.Modal(tourPreviewModalElement, { backdrop: false });
        tourPreviewModal.show();

        document.getElementById('print-preview-tour-plan-button').onclick = () => {
            const printableArea = document.getElementById('preview-tour-plan-printable-area').innerHTML;
            const originalBody = document.body.innerHTML;
            document.body.innerHTML = printableArea;
            window.print();
            document.body.innerHTML = originalBody;
            location.reload();
        };

        currentPreviewRouteId = routeId;
        currentPreviewRouteIndex = currentFilteredRoutes.findIndex(r => r.id === routeId);
        updatePreviewNavigationButtons();

    } catch (error) {
        console.error('Rota önizleme hatası:', error);
        showNotification(`Rota önizlenirken hata oluştu: ${error.message}`, 'error');
    }
}

function updatePreviewNavigationButtons() {
    const prevButton = document.getElementById('prev-tour-button');
    const nextButton = document.getElementById('next-tour-button');

    console.log('updatePreviewNavigationButtons called.');
    console.log('currentPreviewRouteIndex:', currentPreviewRouteIndex);
    console.log('currentFilteredRoutes.length:', currentFilteredRoutes.length);

    if (currentPreviewRouteIndex <= 0) {
        prevButton.setAttribute('disabled', 'true');
        console.log('Prev button disabled.');
    } else {
        prevButton.removeAttribute('disabled');
        console.log('Prev button enabled.');
    }

    if (currentPreviewRouteIndex >= currentFilteredRoutes.length - 1) {
        nextButton.setAttribute('disabled', 'true');
        console.log('Next button disabled.');
    } else {
        nextButton.removeAttribute('disabled');
        console.log('Next button enabled.');
    }
}

async function navigateToTour(direction) {
    console.log('navigateToTour called with direction:', direction);
    const newIndex = currentPreviewRouteIndex + direction;
    console.log('New index calculated:', newIndex);
    if (newIndex >= 0 && newIndex < currentFilteredRoutes.length) {
        const newRouteId = currentFilteredRoutes[newIndex].id;
        console.log('Navigating to new route ID:', newRouteId);
        await showRouteInPreview(newRouteId);
    } else {
        console.log('Navigation out of bounds.');
    }
}

async function handlePreviewRoute(event) {
    const routeId = event.currentTarget.dataset.id;
    // Hangi listeden geldiğini belirle ve currentFilteredRoutes'u ayarla
    const parentListId = event.currentTarget.closest('.list-group').id;
    if (parentListId === 'today-routes-list') {
        currentFilteredRoutes = allRoutes.filter(route => {
            const routeDate = new Date(route.createdAt);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return routeDate >= today;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (parentListId === 'yesterday-routes-list') {
        currentFilteredRoutes = allRoutes.filter(route => {
            const routeDate = new Date(route.createdAt);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return routeDate >= yesterday && routeDate < today;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (parentListId === 'archive-routes-list' || parentListId === 'filtered-archive-routes-list') {
        // currentFilteredRoutes zaten showTourArchiveView veya handleHashtagClick tarafından ayarlanmış olmalı
        // Eğer bu fonksiyonlar çağrılmadıysa, tüm rotaları kullan
        if (currentFilteredRoutes.length === 0 && allRoutes.length > 0) {
            currentFilteredRoutes = allRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    } else {
        // Varsayılan olarak tüm rotaları kullan
        currentFilteredRoutes = allRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    await showRouteInPreview(routeId);
}

function renderSavedRoutes() {
    const todayList = document.getElementById('today-routes-list');
    const yesterdayList = document.getElementById('yesterday-routes-list');
    todayList.innerHTML = '';
    yesterdayList.innerHTML = '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayRoutes = allRoutes.filter(route => {
        const routeDate = new Date(route.createdAt);
        return routeDate >= today;
    });

    const yesterdayRoutes = allRoutes.filter(route => {
        const routeDate = new Date(route.createdAt);
        return routeDate >= yesterday && routeDate < today;
    });

    if (todayRoutes.length === 0) {
        todayList.innerHTML = '<p class="text-muted text-center">Bugün için kayıtlı tur bulunmamaktadır.</p>';
    }
    todayRoutes.forEach(route => todayList.appendChild(createRouteListItem(route, false)));

    if (yesterdayRoutes.length === 0) {
        yesterdayList.innerHTML = '<p class="text-muted text-center">Dün için kayıtlı tur bulunmamaktadır.</p>';
    }
    yesterdayRoutes.forEach(route => yesterdayList.appendChild(createRouteListItem(route, false)));
}

function createRouteListItem(route, includeHashtags = true) {
    const item = document.createElement('div');
    item.className = 'list-group-item list-group-item-action flex-column align-items-start';

    let hashtagsHtml = '';
    if (includeHashtags && route.cityHashtags && route.cityHashtags.length > 0) {
        hashtagsHtml = route.cityHashtags.map(tag => `<span class="badge bg-secondary me-1 hashtag-badge" style="cursor: pointer;">${tag}</span>`).join('');
    }

    const createdAtDate = new Date(route.createdAt);
    let updatedAtDate = null;
    if (route.updatedAt) {
        if (typeof route.updatedAt.toDate === 'function') { // It's a Firestore Timestamp object from the SDK
            updatedAtDate = route.updatedAt.toDate();
        } else if (typeof route.updatedAt === 'object' && route.updatedAt._seconds !== undefined && route.updatedAt._nanoseconds !== undefined) { // It's a plain object representing a Timestamp
            updatedAtDate = new Date(route.updatedAt._seconds * 1000 + route.updatedAt._nanoseconds / 1000000);
        } else { // Assume it's already a valid date string or Date object
            updatedAtDate = new Date(route.updatedAt);
        }
    }

    item.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${route.routeName}</h6>
            <small>${createdAtDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}</small>
        </div>
        <p class="mb-1"><small>Şoför: ${route.driverId ? allDrivers.find(d => d.id === route.driverId)?.name || 'Bilinmiyor' : 'Bilinmiyor'}</small></p>
        <p class="mb-1"><small>Oluşturulma: ${createdAtDate.toLocaleDateString('de-DE')} ${createdAtDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}</small></p>
        ${updatedAtDate && updatedAtDate.getTime() !== createdAtDate.getTime() ? `<p class="mb-1"><small>Son Güncelleme: ${updatedAtDate.toLocaleDateString('de-DE')} ${updatedAtDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}</small></p>` : ''}
        <div class="mb-2">
            ${hashtagsHtml}
        </div>
        <div>
            <button class="btn btn-sm btn-outline-info preview-route-btn me-2" data-id="${route.id}"><i class="bi bi-eye"></i> Önizle</button>
            <button class="btn btn-sm btn-outline-primary edit-route-btn" data-id="${route.id}">Düzenle</button>
            <button class="btn btn-sm btn-outline-danger delete-route-btn" data-id="${route.id}">Sil</button>
        </div>
    `;
    item.querySelector('.preview-route-btn').addEventListener('click', handlePreviewRoute);
    item.querySelector('.edit-route-btn').addEventListener('click', handleEditRoute);
    item.querySelector('.delete-route-btn').addEventListener('click', handleDeleteRoute);

    if (includeHashtags) {
        item.querySelectorAll('.hashtag-badge').forEach(badge => {
            badge.addEventListener('click', handleHashtagClick);
        });
    }

    return item;
}

async function handleDeleteRoute(event) {
    const routeId = event.currentTarget.dataset.id;
    const routeElement = event.currentTarget.closest('.list-group-item');

    if (confirm('Bu rotayı kalıcı olarak silmek istediğinizden emin misiniz?')) {
        try {
            const response = await fetch(`http://localhost:3000/api/routing/routes/${routeId}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Rota silinemedi.');
            }
            showNotification('Rota başarıyla silindi.', 'success');

            if (routeElement) {
                routeElement.remove();
            }

            allRoutes = allRoutes.filter(route => route.id !== routeId);

            renderSavedRoutes();

        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleEditRoute(event) {
    const routeId = event.currentTarget.dataset.id;
    try {
        const response = await fetchWithAuth(`http://localhost:3000/api/routing/routes/${routeId}`);
        if (!response.ok) {
            throw new Error('Rota bilgileri yüklenemedi.');
        }
        const routeData = await response.json();

        showRouteCreationFormContent();
        resetRouteCreationFormContent();

        currentEditingRouteId = routeData.id;
        document.getElementById('route-name').value = routeData.routeName.split('_')[0];
        document.getElementById('driver-select').value = routeData.driverId;

        const startSelect = document.getElementById('start');
        const endSelect = document.getElementById('end');
        const weightInput = document.getElementById('weight');

        startSelect.innerHTML = '';
        endSelect.innerHTML = '';

        const startCoords = routeData.startPoint;
        if (startCoords) {
            const startAddress = await getAddressFromCoords(startCoords) || startCoords;
            const startOption = new Option(startAddress, startCoords);
            startSelect.add(startOption);
            startSelect.value = startCoords;
        }

        const endCoords = routeData.endPoint;
        if (endCoords) {
            const endAddress = await getAddressFromCoords(endCoords) || endCoords;
            const endOption = new Option(endAddress, endCoords);
            endSelect.add(endOption);
            endSelect.value = endCoords;
        }

        weightInput.value = routeData.truckWeight;

        selectedRouteMarkets = routeData.stops
            .filter(stop => stop.id !== 'start' && stop.id !== 'end')
            .map(stop => {
                const marketDetails = allMarkets.find(m => m.id === stop.id);
                return { 
                    ...marketDetails, 
                    ...stop,
                    euroPallets: stop.euroPallets || 0,
                    widePallets: stop.widePallets || 0,
                    euroPalletKg: stop.euroPalletKg || 0,
                    widePalletKg: stop.widePalletKg || 0
                };
            });
        
        renderFinalMarketList();

        const selectedDriver = allDrivers.find(d => d.id === routeData.driverId);
        updateTourPlan(routeData.stops, selectedDriver, selectedRouteMarkets);

        const routeButton = document.getElementById('routeButton');
        routeButton.textContent = 'Rotayı Güncelle';
        routeButton.removeEventListener('click', handleCreateOrUpdateRoute);
        routeButton.addEventListener('click', handleUpdateRoute);

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function handleHashtagClick(event) {
    const hashtag = event.target.textContent;
    const cityName = hashtag.substring(1);

    const filteredRoutes = allRoutes.filter(route => 
        route.cityHashtags && route.cityHashtags.includes(hashtag)
    );
    
    currentFilteredRoutes = filteredRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Tarihe göre sırala

    document.getElementById('archive-main-view').classList.add('d-none');
    document.getElementById('archive-filtered-view').classList.remove('d-none');

    document.getElementById('filtered-archive-title').textContent = `${cityName} şehrine gidilen turlar`;

    const filteredListContainer = document.getElementById('filtered-archive-routes-list');
    filteredListContainer.innerHTML = '';
    if (currentFilteredRoutes.length === 0) {
        filteredListContainer.innerHTML = '<p class="text-muted text-center">Bu şehre ait tur bulunamadı.</p>';
    } else {
        currentFilteredRoutes.forEach(route => {
            filteredListContainer.appendChild(createRouteListItem(route, true));
        });
    }
}

function showArchiveMainView() {
    document.getElementById('archive-filtered-view').classList.add('d-none');
    document.getElementById('archive-main-view').classList.remove('d-none');
    currentFilteredRoutes = allRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Tüm rotaları varsayılan olarak ayarla
}

// Klavye olay dinleyicisi
document.addEventListener('keydown', (event) => {
    if (document.getElementById('tourPreviewModal').classList.contains('show')) { // Modal açıksa
        if (event.key === 'ArrowLeft') {
            navigateToTour(-1); // Önceki tur (ters sıralama nedeniyle)
        } else if (event.key === 'ArrowRight') {
            navigateToTour(1); // Sonraki tur (ters sıralama nedeniyle)
        }
    }
});
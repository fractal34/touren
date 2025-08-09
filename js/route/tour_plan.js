// --- TUR PLANI TABLOSU YÖNETİMİ ---

function updateTourPlan(optimizedSequence, driver, markets) {
    const dateEl = document.getElementById('tour-plan-date');
    const driverEl = document.getElementById('tour-plan-driver');
    const tableBody = document.getElementById('tour-plan-table-body');
    const totalPalletsEl = document.getElementById('tour-plan-total-pallets');
    const totalKgEl = document.getElementById('tour-plan-total-kg');

    dateEl.innerHTML = `<strong>Tarih:</strong> ${new Date().toLocaleDateString('de-DE')}`;
    driverEl.innerHTML = driver ? `<strong>Şoför:</strong> ${driver.name} ${driver.licensePlate}` : '<strong>Şoför:</strong> --';

    tableBody.innerHTML = '';
    let totalPallets = 0;
    let totalKg = 0;

    const stops = optimizedSequence.filter(wp => wp.id !== 'start' && wp.id !== 'end');

    stops.forEach((stop, index) => {
        const market = markets.find(m => m.id === stop.id);
        if (!market) return;

        const euroPallets = market.euroPallets || 0;
        const widePallets = market.widePallets || 0;
        const kg = market.totalKg || 0;
        totalPallets += euroPallets + widePallets;
        totalKg += kg;

        let palletCellHtml = `
            <table class="inner-pallet-table">
                <tr>
                    <th>E</th>
                    <th>G</th>
                </tr>
                <tr>
                    <td>${euroPallets}</td>
                    <td>${widePallets || ''}</td>
                </tr>
            </table>
        `;

        const row = `
            <tr data-id="${market.id}">
                <td class="tour-plan-index-col">${index + 1}</td>
                <td>${market.customerNumber || ''}</td>
                <td class="text-start">
                    <strong>${market.name}</strong><br>
                    <small>${market.addressDetails.city}</small>
                </td>
                <td>${palletCellHtml}</td>
                <td>${kg}</td>
                <td contenteditable="true" data-field="notes">
                    ${market.notes || ''}
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    const specialNotesContentDiv = document.getElementById('special-notes-content');
    specialNotesContentDiv.innerHTML = '';

    const marketsWithSpecialNotes = markets.filter(m => m.specialNotes && m.specialNotes.trim() !== '');

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

    totalPalletsEl.textContent = totalPallets;
    totalKgEl.textContent = totalKg.toLocaleString();

    if (sortableTourPlan) sortableTourPlan.destroy();
    sortableTourPlan = new Sortable(tableBody, {
        animation: 150,
        ghostClass: 'bg-info-subtle',
        handle: '.tour-plan-index-col',
        onEnd: async (evt) => {
            const [movedItem] = stops.splice(evt.oldIndex, 1);
            stops.splice(evt.newIndex, 0, movedItem);

            const driver = allDrivers.find(d => d.id === document.getElementById('driver-select').value);
            updateTourPlan(stops, driver, markets);
            showNotification('Sıralama güncelleniyor...', 'info');

            try {
                const routeId = currentEditingRouteId;
                if (!routeId) {
                    console.warn('Düzenleme modunda Rota ID bulunamadı, sıralama kaydedilemedi.');
                    return;
                }

                const response = await fetch(`http://localhost:3000/api/routing/routes/${routeId}/sequence`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stops: stops })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Sıralama sunucuya kaydedilemedi.');
                }
                showNotification('Rota sıralaması başarıyla güncellendi.', 'success');
                await renderSavedRoutes();
            } catch (error) {
                console.error('Sıralama kaydetme hatası:', error);
                showNotification(`Sıralama kaydedilirken hata: ${error.message}`, 'error');
            }
        }
    });
}

function updateTourPlanTotals() {
    const totalPalletsEl = document.getElementById('tour-plan-total-pallets');
    const totalKgEl = document.getElementById('tour-plan-total-kg');

    let totalPallets = 0;
    let totalKg = 0;

    selectedRouteMarkets.forEach(market => {
        totalPallets += (market.euroPallets || 0) + (market.widePallets || 0);
        totalKg += market.totalKg || 0;
    });

    if (totalPalletsEl) {
        totalPalletsEl.textContent = totalPallets;
    }
    if (totalKgEl) {
        totalKgEl.textContent = totalKg.toLocaleString();
    }
}

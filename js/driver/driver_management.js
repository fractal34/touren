// --- ŞOFÖR YÖNETİMİ FONKSİYONLARI ---

function renderDriverList(drivers) {
    const driverList = document.getElementById('driver-list');
    if (!driverList) return;

    driverList.innerHTML = '';
    drivers.forEach(driver => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <span>
                <strong>${driver.name}</strong> <small class="text-muted">(${driver.licensePlate})</small>
            </span>
            <div>
               <button class="btn btn-sm btn-outline-primary me-2 edit-driver-btn" data-id="${driver.id}"><i class="bi bi-pencil-fill"></i></button>
               <button class="btn btn-sm btn-outline-danger delete-driver-btn" data-id="${driver.id}"><i class="bi bi-trash"></i></button>
            </div>
        `;
        listItem.querySelector('.edit-driver-btn').addEventListener('click', handleEditDriver);
        listItem.querySelector('.delete-driver-btn').addEventListener('click', handleDeleteDriver);
        driverList.appendChild(listItem);
    });
}

function resetDriverForm() {
    const form = document.getElementById('add-driver-form');
    form.reset();
    form.querySelector('h6').textContent = 'Yeni Şoför Ekle';
    form.querySelector('button[type="submit"]').textContent = 'Şoför Ekle';
    form.querySelector('button[type="submit"]').classList.replace('btn-primary', 'btn-success');
    currentEditingDriverId = null;
}

function handleEditDriver(event) {
    currentEditingDriverId = event.currentTarget.dataset.id;
    const driver = allDrivers.find(d => d.id === currentEditingDriverId);
    if (driver) {
        populateDriverForm(driver);
    }
}

function populateDriverForm(driver) {
    const form = document.getElementById('add-driver-form');
    form.querySelector('#driver-name').value = driver.name;
    form.querySelector('#driver-plate').value = driver.licensePlate;
    form.querySelector('#driver-max-pallets').value = driver.maxPallets;
    form.querySelector('#driver-pallet-capacity').value = driver.palletCapacity || '';
    form.querySelector('#driver-fixed-start').value = driver.fixedStart.address;
    form.querySelector('#driver-fixed-end').value = driver.fixedEnd.address;

    form.querySelector('h6').textContent = 'Şoför Düzenle';
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Değişiklikleri Kaydet';
    submitButton.classList.replace('btn-success', 'btn-primary');
    window.scrollTo(0, 0);
}

async function handleAddDriver(event) {
    event.preventDefault();
    const driverData = {
        name: document.getElementById('driver-name').value,
        licensePlate: document.getElementById('driver-plate').value,
        maxPallets: document.getElementById('driver-max-pallets').value,
        palletCapacity: document.getElementById('driver-pallet-capacity').value,
        fixedStartAddress: document.getElementById('driver-fixed-start').value,
        fixedEndAddress: document.getElementById('driver-fixed-end').value
    };

    try {
        const response = await fetchWithAuth('/api/drivers', {
            method: 'POST',
            body: JSON.stringify(driverData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Şoför eklenemedi.');
        
        showNotification('Şoför başarıyla eklendi!', 'success');
        document.getElementById('add-driver-form').reset();
        await loadInitialData(); // Verileri ve listeyi yenile
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteDriver(event) {
    const driverId = event.currentTarget.dataset.id;
    if (confirm('Bu şoförü silmek istediğinizden emin misiniz?')) {
        try {
            const response = await fetchWithAuth(`/api/drivers/${driverId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Şoför silinemedi.');
            showNotification('Şoför başarıyla silindi.', 'success');
            await loadInitialData(); // Verileri yeniden yükle
            renderDriverList(allDrivers); // Listeyi güncel verilerle yeniden çiz
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

function showDriverManagementView() {
    hideAllControlPanels();
    document.getElementById('driver-management-view').classList.remove('d-none');
    renderDriverList(allDrivers); // Mevcut yüklenmiş verilerle listeyi çiz
}

// YENİ FONKSİYON: Şoför seçimi değiştiğinde tetiklenir
function handleDriverSelectionChange(event) {
    const driverId = event.target.value;
    const selectedDriver = allDrivers.find(d => d.id === driverId);

    const startSelect = document.getElementById('start');
    const endSelect = document.getElementById('end');
    const weightInput = document.getElementById('weight');
    const palletCapacityInput = document.getElementById('truck-pallet-capacity');

    // Önceki şoförden kalan özel seçenekleri temizle
    Array.from(startSelect.options).forEach(opt => {
        if (opt.dataset.driverSpecific) startSelect.remove(opt.index);
    });
    Array.from(endSelect.options).forEach(opt => {
        if (opt.dataset.driverSpecific) endSelect.remove(opt.index);
    });

    if (selectedDriver) {
        // Tonaj ve Palet Kapasitesini Güncelle (Hem eski `maxWeight` hem de yeni `maxPallets` ile uyumlu)
        weightInput.value = selectedDriver.maxPallets || selectedDriver.maxWeight || 0;
        palletCapacityInput.value = selectedDriver.palletCapacity || 0;

        // Başlangıç ve Bitiş Noktalarını Güncelle
        if (selectedDriver.fixedStart && selectedDriver.fixedStart.coordinates) {
            const startCoords = `${selectedDriver.fixedStart.coordinates.lat},${selectedDriver.fixedStart.coordinates.lng}`;
            const startOption = new Option(selectedDriver.fixedStart.address, startCoords, true, true);
            startOption.dataset.driverSpecific = true; // Bu seçeneğin şoföre özel olduğunu işaretle
            startSelect.add(startOption);
            startSelect.value = startCoords;
        }

        if (selectedDriver.fixedEnd && selectedDriver.fixedEnd.coordinates) {
            const endCoords = `${selectedDriver.fixedEnd.coordinates.lat},${selectedDriver.fixedEnd.coordinates.lng}`;
            const endOption = new Option(selectedDriver.fixedEnd.address, endCoords, true, true);
            endOption.dataset.driverSpecific = true; // Bu seçeneğin şoföre özel olduğunu işaretle
            endSelect.add(endOption);
            endSelect.value = endCoords;
        }

    } else {
        // Şoför seçilmediyse alanları varsayılan değerlere döndür
        weightInput.value = 25000;
        palletCapacityInput.value = 34;
        // Genel başlangıç/bitiş noktalarını yeniden doldur
        populateStartEndLocations(); 
    }

    // Değişikliklerin UI'a yansıması için toplamları güncelle
    if (typeof updateTotals === 'function') {
        updateTotals();
    }
}
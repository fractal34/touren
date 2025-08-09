// --- ÖZEL ALAN YÖNETİMİ FONKSİYONLARI ---

async function loadCustomFields() {
    try {
        const response = await fetchWithAuth('/api/custom-fields');
        if (!response.ok) throw new Error('Özel alanlar yüklenemedi.');
        globalCustomFields = await response.json(); // globalCustomFields adı hala kullanılıyor, bu daha sonra refactor edilebilir.
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleAddCustomField() {
    const newLabel = prompt('Yeni özel alanın adını girin:');
    if (!newLabel || !newLabel.trim()) {
        showNotification('Alan adı boş bırakılamaz.', 'error');
        return;
    }

    try {
        const response = await fetchWithAuth('/api/custom-fields', {
            method: 'POST',
            body: JSON.stringify({ label: newLabel.trim() })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification('Özel alan başarıyla eklendi!', 'success');
            await loadCustomFields();
            // Market düzenleyiciyi yenilemek için (mevcut market veya yeni market taslağı ile)
            const marketData = getCurrentMarketEditorData();
            populateMarketEditor(marketData);
        } else {
            throw new Error(data.message || 'Özel alan eklenemedi.');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showCustomFieldManagementSection() {
    document.getElementById('global-field-management-section').style.display = 'block';
    loadCustomFields();
}

function hideCustomFieldManagementSection() {
    document.getElementById('global-field-management-section').style.display = 'none';
}

async function handleEditCustomField(event) {
    const fieldId = event.target.dataset.id;
    const currentLabel = event.target.dataset.label;
    const newLabel = prompt(`"${currentLabel}" alanının yeni adını girin:`, currentLabel);

    if (!newLabel || !newLabel.trim() || newLabel === currentLabel) return;

    try {
        const response = await fetchWithAuth(`/api/custom-fields/${fieldId}`, {
            method: 'PUT',
            body: JSON.stringify({ label: newLabel.trim() })
        });

        const updatedField = await response.json();
        if (!response.ok) {
            throw new Error(updatedField.message || 'Özel alan güncellenemedi.');
        }

        showNotification(`"${currentLabel}" alanı "${newLabel}" olarak güncellendi.`, 'success');
        await loadCustomFields();
        const marketData = getCurrentMarketEditorData();
        populateMarketEditor(marketData);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteCustomField(event) {
    const fieldId = event.target.dataset.id;
    if (confirm('Bu özel alanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
        try {
            const response = await fetchWithAuth(`/api/custom-fields/${fieldId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Özel alan silinemedi.');
            
            showNotification('Özel alan başarıyla silindi.', 'success');
            await loadCustomFields();
            const marketData = getCurrentMarketEditorData();
            populateMarketEditor(marketData);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

// Market düzenleyici formundaki mevcut verileri toplayan yardımcı fonksiyon
function getCurrentMarketEditorData() {
    const marketId = document.getElementById('market-editor-id').value || null;
    const customFieldValues = {};
    document.querySelectorAll('#market-editor-custom-fields-container .form-control[data-field-id]').forEach(input => {
        customFieldValues[input.dataset.fieldId] = input.value;
    });

    return {
        id: marketId,
        name: document.getElementById('market-editor-name').value,
        customerNumber: document.getElementById('market-editor-customer-number').value,
        addressDetails: {
            street: document.getElementById('market-editor-street').value,
            number: document.getElementById('market-editor-number').value,
            zip: document.getElementById('market-editor-zip').value,
            city: document.getElementById('market-editor-city').value,
            country: document.getElementById('market-editor-country').value,
        },
        notes: document.getElementById('market-editor-notes').value,
        specialNotes: document.getElementById('market-editor-special-notes').value,
        euroPalletKg: document.getElementById('market-editor-euro-pallet-kg').value || 0,
        widePalletKg: document.getElementById('market-editor-wide-pallet-kg').value || 0,
        customFieldValues: customFieldValues
    };
}
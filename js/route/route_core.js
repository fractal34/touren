// --- ROTA OLUŞTURMA VE GÜNCELLEME ÇEKİRDEK FONKSİYONLARI ---

async function handleCreateOrUpdateRoute() {
    // Önceki hatalı market vurgularını temizle
    document.querySelectorAll('#final-market-list .list-group-item').forEach(item => {
        item.classList.remove('bg-danger-subtle');
    });

    // YENİ: Palet Adet/Kilo Tutarlılık Kontrolü
    let validationError = false;
    for (const market of selectedRouteMarkets) {
        const kgEnteredButCountZero = (market.totalKg > 0 && (market.euroPallets === 0 && market.widePallets === 0));
        if (kgEnteredButCountZero) {
            validationError = true;
            // Hatalı marketi arayüzde vurgula
            const marketElement = document.querySelector(`#final-market-list .list-group-item[data-id='${market.id}']`);
            if (marketElement) {
                marketElement.classList.add('bg-danger-subtle');
            }
        }
    }

    if (validationError) {
        showNotification('Lütfen palet sayılarını eksiksiz doldurun. Kilo girilmiş ancak adedi 0 olan marketler var (kırmızı ile işaretlendi).', 'error');
        return; // Rota oluşturmayı durdur
    }

    document.getElementById('preloader').style.display = 'flex';
    
    const routeNameInput = document.getElementById('route-name');
    let routeName = routeNameInput.value.trim();
    
    if (!routeName) {
        showNotification('Lütfen bir rota ismi girin.', 'error');
        routeNameInput.focus();
        document.getElementById('preloader').style.display = 'none';
        return;
    }

    // YENİ: Tüm palet ve kilo değerlerinin sıfır olup olmadığını kontrol et
    const totalPalletsAndKg = selectedRouteMarkets.reduce((sum, market) => {
        return sum + (market.euroPallets || 0) + (market.widePallets || 0) + (market.totalKg || 0);
    }, 0);

    if (totalPalletsAndKg === 0) {
        showNotification('Lütfen en az bir market için palet veya kilo bilgisi girin.', 'error');
        document.getElementById('preloader').style.display = 'none';

        // Tüm palet ve kilo inputlarını kırmızı yap
        selectedRouteMarkets.forEach(market => {
            const marketElement = document.querySelector(`#final-market-list .list-group-item[data-id='${market.id}']`);
            if (marketElement) {
                marketElement.querySelectorAll('.pallet-input').forEach(input => {
                    input.classList.add('is-invalid');
                });
            }
        });

        // Hata mesajı gösterildikten sonra is-invalid sınıfını kaldır
        setTimeout(() => {
            selectedRouteMarkets.forEach(market => {
                const marketElement = document.querySelector(`#final-market-list .list-group-item[data-id='${market.id}']`);
                if (marketElement) {
                    marketElement.querySelectorAll('.pallet-input').forEach(input => {
                        input.classList.remove('is-invalid');
                    });
                }
            });
        }, 3000); // 3 saniye sonra kaldır
        return;
    }

    // Tarihi formatla (GG.AA.YYYY)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Aylar 0'dan başlar
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;

    const finalRouteName = `${routeName}_${formattedDate}`;

    const startPoint = document.getElementById('start').value;
    const endPoint = document.getElementById('end').value;
    const truckWeight = parseInt(document.getElementById('weight').value, 10);
    const truckPalletCapacity = parseInt(document.getElementById('truck-pallet-capacity').value, 10);

    // Seçilen marketlerin ID ve koordinatlarını al
    const viaPointsData = selectedRouteMarkets.map(market => ({
        id: market.id, // Firestore ID'sini ekliyoruz
        lat: market.coordinates.lat,
        lng: market.coordinates.lng
    }));

    if (!startPoint || !endPoint || viaPointsData.length === 0) {
        showNotification('Lütfen başlangıç, bitiş ve en az bir ara nokta seçin.', 'error');
        document.getElementById('preloader').style.display = 'none';
        return;
    }

    // Eğer currentEditingRouteId varsa, güncelleme işlemi yap
    if (currentEditingRouteId) {
        try {
            const routeToUpdate = {
                routeName: finalRouteName,
                driverId: document.getElementById('driver-select').value,
                startPoint: startPoint,
                endPoint: endPoint,
                truckWeight: truckWeight,
                truckPalletCapacity: truckPalletCapacity, // YENİ: Palet kapasitesi eklendi
                stops: selectedRouteMarkets.map(market => ({
                    id: market.id,
                    lat: market.coordinates.lat,
                    lng: market.coordinates.lng,
                    euroPallets: market.euroPallets || 0,
                    widePallets: market.widePallets || 0,
                    totalKg: market.totalKg || 0,
                    notes: market.notes || '', // Notları da ekle
                })),
            };

            const updateResponse = await fetchWithAuth(`/api/routing/routes/${currentEditingRouteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(routeToUpdate)
            });

            const updateData = await updateResponse.json();

            if (updateResponse.ok) {
                showNotification('Rota başarıyla güncellendi!', 'success');
                await renderSavedRoutes(); // LİSTEYİ YENİLE

                // YENİ: Harita ve Tur Planı güncellemeleri
                const updatedRoute = updateData.updatedRoute; // Backend'den dönen güncel rota verisi

                // Haritayı temizle ve yeniden çiz
                map.removeObjects(map.getObjects());

                // Rota sınırlarını (bounds) yeniden hesapla
                let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                updatedRoute.stops.forEach(point => {
                    minLat = Math.min(minLat, point.lat);
                    maxLat = Math.max(maxLat, point.lat);
                    minLng = Math.min(minLng, point.lng);
                    maxLng = Math.max(maxLng, point.lng);
                });
                const boundingBox = new H.geo.Rect(minLat, minLng, maxLat, maxLng);

                // Detaylı rota geometrilerini haritaya çiz
                if (updatedRoute.hereApiResult && updatedRoute.hereApiResult.polylines) {
                    updatedRoute.hereApiResult.polylines.forEach((polyline) => {
                        const linestring = H.geo.LineString.fromFlexiblePolyline(polyline);
                        const routeLine = new H.map.Polyline(linestring, { style: { lineWidth: 8, strokeColor: 'rgba(0, 128, 255, 0.7)' }});
                        map.addObject(routeLine);
                    });
                }

                // İşaretçileri yeniden çiz
                const markers = updatedRoute.stops.map((point, index) => {
                    if (typeof point.lat !== 'number' || typeof point.lng !== 'number' || isNaN(point.lat) || isNaN(point.lng)) {
                        console.warn(`Geçersiz koordinatlar:`, point);
                        return null;
                    }
                    let markerHtml = '';
                    if (point.id === 'start') {
                        markerHtml = '<div style="font-size: 1.2em; font-weight: bold; color: white; background-color: green; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">S</div>';
                    } else if (point.id === 'end') {
                        markerHtml = '<div style="font-size: 1.2em; font-weight: bold; color: white; background-color: red; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">B</div>';
                    } else {
                        const stopNumber = point.sequenceNumber; // Assuming sequenceNumber is available or can be derived
                        markerHtml = `<div style="font-size: 1.2em; font-weight: bold; color: black; background-color: yellow; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">${stopNumber}</div>`;
                    }
                    const icon = new H.map.DomIcon(markerHtml);
                    const geoPoint = new H.geo.Point(point.lat, point.lng);
                    return new H.map.DomMarker(geoPoint, { icon: icon });
                }).filter(Boolean);
                map.addObjects(markers);

                // BoundingBox geçerliyse harita görünümünü ayarla
                if (boundingBox && isFinite(minLat)) {
                    map.getViewModel().setLookAtData({ bbox: boundingBox });
                } else {
                    console.warn("Rota için BoundingBox oluşturulamadı.");
                }

                // selectedRouteMarkets'ı güncel rota verisiyle güncelle
                selectedRouteMarkets = updatedRoute.stops
                    .filter(wp => wp.id !== 'start' && wp.id !== 'end')
                    .map(stop => {
                        const originalMarket = allMarkets.find(m => m.id === stop.id);
                        return {
                            ...originalMarket,
                            euroPallets: stop.euroPallets || 0,
                            widePallets: stop.widePallets || 0,
                            totalKg: stop.totalKg || 0,
                        };
                    }).filter(Boolean);
                renderFinalMarketList();

                const selectedDriver = allDrivers.find(d => d.id === document.getElementById('driver-select').value);
                updateTourPlan(updatedRoute.stops, selectedDriver, selectedRouteMarkets); // updatedRoute.stops kullan

                document.getElementById('distance').textContent = `${updatedRoute.summary.totalDistanceKm.toFixed(2)} km`;
                document.getElementById('travel-time').textContent = `${updatedRoute.summary.totalTimeHours.toFixed(2)} saat`;

            } else {
                showNotification(`Rota güncellenemedi: ${updateData.message || 'Bilinmeyen hata'}`, 'error');
            }
        } catch (error) {
            showNotification("Rota güncellenirken sunucuya bağlanılamadı.", 'error');
        } finally {
            document.getElementById('preloader').style.display = 'none';
        }
        return;
    }

    // Yeni rota oluşturma mantığı
    try {
        const optimizeResponse = await fetch(`/api/routing/optimize-route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                origin: startPoint, 
                destination: endPoint, 
                viaPoints: viaPointsData, 
                truckSpecs: { maxWeight: truckWeight } 
            }),
            truckPalletCapacity: truckPalletCapacity // YENİ: Palet kapasitesi eklendi
        });

        const optimizeData = await optimizeResponse.json();
        console.log("Optimize Data (from /optimize-route):");
        console.log(optimizeData);

        if (optimizeResponse.ok && optimizeData.success) {
            showNotification('Sıralama optimize edildi, detaylı rota alınıyor...', 'info');

            // Rota verilerini ve diğer bilgileri bir araya topla
            const routeToSave = {
                routeName: finalRouteName,
                driverId: document.getElementById('driver-select').value,
                startPoint: startPoint,
                endPoint: endPoint,
                truckWeight: truckWeight,
                truckPalletCapacity: truckPalletCapacity, // YENİ: Palet kapasitesi eklendi
                stops: optimizeData.optimizedSequence.map(optimizedStop => {
                    if (optimizedStop.id === 'start' || optimizedStop.id === 'end') {
                        return optimizedStop; // Keep start/end points as is
                    }
                    const market = selectedRouteMarkets.find(m => m.id === optimizedStop.id);
                    return {
                        ...optimizedStop,
                        euroPallets: market ? market.euroPallets : 0,
                        widePallets: market ? market.widePallets : 0,
                        totalKg: market ? market.totalKg : 0,
                    };
                }),
                summary: optimizeData.summary,
                createdAt: new Date().toISOString()
            };

            // 2. ADIM: Optimize edilmiş sıralama ile detaylı rotayı al VE KAYDET
            const detailedRouteResponse = await fetchWithAuth('/api/routing/detailed-route-and-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    routeData: routeToSave 
                })
            });

            const detailedRouteData = await detailedRouteResponse.json();
            console.log("Detailed Route Data (from /detailed-route-and-save):");
            console.log(detailedRouteData);

            if (detailedRouteResponse.ok && detailedRouteData.route) {
                showNotification('Rota başarıyla oluşturuldu ve kaydedildi!', 'success');
                console.log("loadInitialData() çağrılıyor...");
                await loadInitialData(); // Tüm verileri yeniden yükle
                console.log("loadInitialData() tamamlandı.");

                // YENİ: currentEditingRouteId'yi ayarla ve düğme metnini değiştir
                currentEditingRouteId = detailedRouteData.routeId;
                routeButton.textContent = 'Rotayı Güncelle';

                try {
                    // --- HARİTA GÜNCELLEME BAŞLANGIÇ ---
                    map.removeObjects(map.getObjects());

                    // 1. Rota sınırlarını (bounds) MANUEL olarak hesapla
                    if (!optimizeData.optimizedSequence || optimizeData.optimizedSequence.length === 0) {
                        throw new Error("Optimize edilmiş rota noktaları bulunamadı.");
                    }

                    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                    optimizeData.optimizedSequence.forEach(point => {
                        minLat = Math.min(minLat, point.lat);
                        maxLat = Math.max(maxLat, point.lat);
                        minLng = Math.min(minLng, point.lng);
                        maxLng = Math.max(maxLng, point.lng);
                    });

                    const boundingBox = new H.geo.Rect(minLat, minLng, maxLat, maxLng);

                    // 2. Detaylı rota geometrilerini haritaya çiz
                    detailedRouteData.route.sections.forEach((section) => {
                        const linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);
                        const routeLine = new H.map.Polyline(linestring, { style: { lineWidth: 8, strokeColor: 'rgba(0, 128, 255, 0.7)' }});
                        map.addObject(routeLine);
                    });

                    const markers = optimizeData.optimizedSequence.map((point, index) => {
                        if (typeof point.lat !== 'number' || typeof point.lng !== 'number' || isNaN(point.lat) || isNaN(point.lng)) {
                            console.warn(`Geçersiz koordinatlar:`, point);
                            return null;
                        }
                        let markerHtml = '';
                        if (point.id === 'start') {
                            markerHtml = '<div style="font-size: 1.2em; font-weight: bold; color: white; background-color: green; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">S</div>';
                        } else if (point.id === 'end') {
                            markerHtml = '<div style="font-size: 1.2em; font-weight: bold; color: white; background-color: red; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">B</div>';
                        } else {
                            const stopNumber = point.sequenceNumber;
                            markerHtml = `<div style="font-size: 1.2em; font-weight: bold; color: black; background-color: yellow; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">${stopNumber}</div>`;
                        }
                        const icon = new H.map.DomIcon(markerHtml);
                        const geoPoint = new H.geo.Point(point.lat, point.lng);
                        return new H.map.DomMarker(geoPoint, { icon: icon });
                    }).filter(Boolean);

                    map.addObjects(markers);
                    
                    // BoundingBox geçerliyse harita görünümünü ayarla
                    if (boundingBox && isFinite(minLat)) {
                        map.getViewModel().setLookAtData({ bbox: boundingBox });
                    } else {
                        console.warn("Rota için BoundingBox oluşturulamadı.");
                    }

                    // selectedRouteMarkets'ı optimize edilmiş sıraya ve palet/kg bilgilerine göre güncelle
                    selectedRouteMarkets = detailedRouteData.route.stops
                        .filter(wp => wp.id !== 'start' && wp.id !== 'end')
                        .map(stop => {
                            const originalMarket = allMarkets.find(m => m.id === stop.id);
                            return {
                                ...originalMarket,
                                euroPallets: stop.euroPallets || 0,
                                widePallets: stop.widePallets || 0,
                                totalKg: stop.totalKg || 0,
                            };
                        }).filter(Boolean);
                    renderFinalMarketList();

                    const selectedDriver = allDrivers.find(d => d.id === document.getElementById('driver-select').value);
                    updateTourPlan(optimizeData.optimizedSequence, selectedDriver, selectedRouteMarkets);

                    document.getElementById('distance').textContent = `${optimizeData.summary.totalDistanceKm.toFixed(2)} km`;
                    document.getElementById('travel-time').textContent = `${optimizeData.summary.totalTimeHours.toFixed(2)} saat`;

                } catch (e) {
                    console.error("Harita çizim hatası:", e);
                    showNotification(`Harita çizilirken bir hata oluştu: ${e.message}`, 'error');
                }

            } else {
                showNotification(`Detaylı rota alınamadı: ${detailedRouteData.message || 'Bilinmeyen hata'}`, 'error');
            }
        } else {
            showNotification(`Rota optimizasyonu başarısız: ${optimizeData.message || 'Bilinmeyen hata'}`, 'error');
        }
    } catch (error) {
        console.error("Rota oluşturma/güncelleme sırasında genel hata:", error);
        showNotification(`Rota oluşturma/güncelleme sırasında bir hata oluştu: ${error.message}`, 'error');
    } finally {
        document.getElementById('preloader').style.display = 'none';
    }
}

async function handleUpdateRoute() {
    if (!currentEditingRouteId) return;

    document.getElementById('preloader').style.display = 'flex';

    let routeName = document.getElementById('route-name').value.trim();
    if (!routeName) {
        showNotification('Lütfen bir rota ismi girin.', 'error');
        document.getElementById('preloader').style.display = 'none';
        return;
    }

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;
    const finalRouteName = `${routeName}_${formattedDate}`;

    const updatedRouteData = {
        routeName: finalRouteName,
        driverId: document.getElementById('driver-select').value,
        startPoint: document.getElementById('start').value,
        endPoint: document.getElementById('end').value,
        truckWeight: parseInt(document.getElementById('weight').value, 10),
        truckPalletCapacity: parseInt(document.getElementById('truck-pallet-capacity').value, 10), // YENİ: Palet kapasitesi eklendi
        stops: selectedRouteMarkets.map(m => {
            const fullMarketData = allMarkets.find(originalMarket => originalMarket.id === m.id);
            const coordinates = fullMarketData ? fullMarketData.coordinates : {};
            return {
                id: m.id,
                lat: coordinates.lat,
                lng: coordinates.lng,
                euroPallets: m.euroPallets || 0,
                widePallets: m.widePallets || 0,
                totalKg: m.totalKg || 0, // YENİ: totalKg'yi de gönder
                euroPalletKg: m.euroPalletKg || 0,
                widePalletKg: m.widePalletKg || 0
            };
        }),
    };

    try {
        const response = await fetch(`/api/routing/routes/${currentEditingRouteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedRouteData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Rota güncellenemedi.');
        }

        const result = await response.json();

        showNotification('Rota başarıyla güncellendi!', 'success');
        await renderSavedRoutes();

        const updatedStops = result.updatedRoute.stops;
        const updatedMarkets = updatedStops
            .filter(stop => stop.id !== 'start' && stop.id !== 'end')
            .map(stop => {
                const marketDetails = allMarkets.find(m => m.id === stop.id);
                return { ...marketDetails, ...stop };
            });
        
        selectedRouteMarkets = updatedMarkets;
        renderFinalMarketList();

        const selectedDriver = allDrivers.find(d => d.id === result.updatedRoute.driverId);
        updateTourPlan(updatedStops, selectedDriver, selectedRouteMarkets);

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        document.getElementById('preloader').style.display = 'none';
    }
}

function solveTSPForTruck(waypoints, distanceMatrix) {
  const n = waypoints.length;
  console.log(`TSP başlatılıyor: ${n} waypoint`);
  
  if (n <= 2) {
    return waypoints.map((wp, index) => ({
      ...wp,
      id: index === 0 ? 'start' : 'end',
      sequenceNumber: index
    }));
  }
  
  // İlk nokta (start) ve son nokta (end) sabit kalmalı
  const startPoint = { ...waypoints[0], id: 'start', sequenceNumber: 0 };
  const endPoint = { ...waypoints[waypoints.length - 1], id: 'end' };
  const middlePoints = waypoints.slice(1, -1); // Ara noktalar
  
  console.log(`Ara nokta sayısı: ${middlePoints.length}`);
  
  if (middlePoints.length === 0) {
    return [startPoint, { ...endPoint, sequenceNumber: 1 }];
  }
  
  // Ara noktalar için en yakın komşu algoritması
  const visited = new Array(middlePoints.length).fill(false);
  const result = [startPoint];
  
  let currentIndex = 0; // Start noktasının matrix'teki indeksi
  
  // Ara noktaları optimize et
  for (let i = 0; i < middlePoints.length; i++) {
    let nearestIndex = -1;
    let minDistance = Infinity;
    
    // Henüz ziyaret edilmemiş ara noktalar arasında en yakınını bul
    for (let j = 0; j < middlePoints.length; j++) {
      if (!visited[j]) {
        const middlePointMatrixIndex = j + 1; // Matrix'te ara noktaların indeksi (start'tan sonra başlar)
        
        // Distance matrix kontrolü
        if (distanceMatrix[currentIndex] && 
            distanceMatrix[currentIndex].travelTimes && 
            typeof distanceMatrix[currentIndex].travelTimes[middlePointMatrixIndex] === 'number') {
          
          const distance = distanceMatrix[currentIndex].travelTimes[middlePointMatrixIndex];
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = j;
          }
        }
      }
    }
    
    if (nearestIndex !== -1) {
      visited[nearestIndex] = true;
      result.push({
        ...middlePoints[nearestIndex],
        // id zaten middlePoints içinde geliyor, tekrar atamaya gerek yok
        sequenceNumber: result.length
      });
      currentIndex = nearestIndex + 1; // Matrix'te bu noktanın indeksi
      console.log(`${i + 1}. nokta eklendi: via_${nearestIndex}`);
    } else {
      console.warn(`${i + 1}. adımda en yakın nokta bulunamadı`);
      // Fallback: İlk ziyaret edilmemiş noktayı al
      for (let j = 0; j < middlePoints.length; j++) {
        if (!visited[j]) {
          visited[j] = true;
          result.push({
            ...middlePoints[j],
            id: `via_${j}`,
            sequenceNumber: result.length
          });
          currentIndex = j + 1;
          break;
        }
      }
    }
  }
  
  // Son noktayı ekle
  result.push({
    ...endPoint,
    sequenceNumber: result.length
  });
  
  console.log(`TSP tamamlandı: ${result.length} nokta`);
  return result;
}

module.exports = { solveTSPForTruck };
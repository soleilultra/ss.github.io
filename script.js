// 初始化变量
let map;
let heatmapLayer = null;
let markersLayer = null;
let locationData = JSON.parse(localStorage.getItem('locationData')) || [];
let currentPosition = null;
let selectedRating = null;
let heatmapEnabled = false;
let radiusCircle = null;
let windyMap = null;
let windLayerEnabled = false;

// 侧边栏和顶部栏状态
let sidebarCollapsed = false;
let headerCollapsed = false;

// 初始化地图
function initMap() {
    map = L.map('map').setView([39.9042, 116.4074], 5); // 默认北京中心

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 初始化图层组
    markersLayer = L.layerGroup().addTo(map);

    // 加载已有数据
    loadLocationData();

    // 初始化UI状态
    updateToggleButtons();
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = sidebar.querySelector('.sidebar-toggle i');

    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);

    if (sidebarCollapsed) {
        toggleBtn.classList.remove('fa-chevron-left');
        toggleBtn.classList.add('fa-chevron-right');
    } else {
        toggleBtn.classList.remove('fa-chevron-right');
        toggleBtn.classList.add('fa-chevron-left');
    }

    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
}

// 切换顶部栏
function toggleHeader() {
    const header = document.getElementById('header');

    headerCollapsed = !headerCollapsed;
    header.classList.toggle('collapsed', headerCollapsed);

    localStorage.setItem('headerCollapsed', headerCollapsed);
}

// 更新切换按钮状态
function updateToggleButtons() {
    // 从本地存储获取状态
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    const savedHeaderState = localStorage.getItem('headerCollapsed');

    if (savedSidebarState !== null) {
        sidebarCollapsed = savedSidebarState === 'true';
        document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);

        const toggleBtn = document.querySelector('.sidebar-toggle i');
        if (sidebarCollapsed) {
            toggleBtn.classList.remove('fa-chevron-left');
            toggleBtn.classList.add('fa-chevron-right');
        } else {
            toggleBtn.classList.remove('fa-chevron-right');
            toggleBtn.classList.add('fa-chevron-left');
        }
    }

    if (savedHeaderState !== null) {
        headerCollapsed = savedHeaderState === 'true';
        document.getElementById('header').classList.toggle('collapsed', headerCollapsed);
    }
}

// 计算两点之间的距离（米）
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球半径（米）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// 获取500米半径内的评级统计
function getRatingStatsInRadius(centerLat, centerLng) {
    const radius = 500; // 500米半径
    const stats = { A: 0, B: 0, C: 0, D: 0, total: 0 };

    locationData.forEach(location => {
        const distance = getDistance(centerLat, centerLng, location.latitude, location.longitude);
        if (distance <= radius) {
            stats[location.rating]++;
            stats.total++;
        }
    });

    return stats;
}

// 加载位置数据到地图
function loadLocationData() {
    // 清除现有标记
    markersLayer.clearLayers();

    // 如果没有数据，则更新UI并返回
    if (locationData.length === 0) {
        document.getElementById('statsContainer').innerHTML = '<p>暂无统计数据</p>';
        document.getElementById('locationList').innerHTML = '<p>暂无位置数据</p>';
        return;
    }

    // 创建标记并添加到地图
    locationData.forEach(location => {
        const marker = L.circleMarker([location.latitude, location.longitude], {
            radius: 8,
            fillColor: getRatingColor(location.rating),
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(markersLayer);

        // 创建弹出窗口内容
        const stats = getRatingStatsInRadius(location.latitude, location.longitude);
        const popupContent = `
                    <b>位置评级: ${location.rating}</b><br>
                    纬度: ${location.latitude}<br>
                    经度: ${location.longitude}<br>
                    精确度: ±${location.accuracy}米<br>
                    时间: ${location.timestamp}
                    <div class="radius-stats">
                        <h4>500米半径内统计:</h4>
                        <div class="radius-stat-item rating-A">
                            <span>A级:</span>
                            <span>${stats.A}次</span>
                        </div>
                        <div class="radius-stat-item rating-B">
                            <span>B级:</span>
                            <span>${stats.B}次</span>
                        </div>
                        <div class="radius-stat-item rating-C">
                            <span>C级:</span>
                            <span>${stats.C}次</span>
                        </div>
                        <div class="radius-stat-item rating-D">
                            <span>D级:</span>
                            <span>${stats.D}次</span>
                        </div>
                        <div class="radius-stat-item">
                            <span>总计:</span>
                            <span>${stats.total}次</span>
                        </div>
                    </div>
                `;

        marker.bindPopup(popupContent);

        // 点击标记时显示500米半径范围
        marker.on('click', function (e) {
            // 移除现有的半径圆
            if (radiusCircle) {
                map.removeLayer(radiusCircle);
            }

            // 添加新的半径圆
            radiusCircle = L.circle([location.latitude, location.longitude], {
                radius: 500,
                color: '#0078A8',
                fillColor: '#0078A8',
                fillOpacity: 0.1
            }).addTo(map);
        });
    });

    // 更新热力图
    updateHeatmap();

    // 更新位置列表
    updateLocationList();

    // 更新统计数据
    updateStats();

    // 调整地图视图以包含所有标记
    if (locationData.length > 0) {
        const bounds = markersLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

// 获取评级对应的颜色
function getRatingColor(rating) {
    switch (rating) {
        case 'A': return '#4CAF50';
        case 'B': return '#8BC34A';
        case 'C': return '#FFC107';
        case 'D': return '#FF9800';
        default: return '#999';
    }
}

//实时风向图
function toggleWindLayer() {
    windLayerEnabled = !windLayerEnabled;

    if (windLayerEnabled) {
        if (!windyMap) {
            const options = {
                key: 'YOUR_WINDY_API_KEY', // 替换为您的 Windy API 密钥
                lat: map.getCenter().lat,
                lon: map.getCenter().lng,
                zoom: map.getZoom(),
                overlay: 'wind',
                terrain: true,
                menu: false,
                waves: false,
                pressure: false,
                controls: false
            };

            // 初始化 Windy 图层
            windyInit(options, windyAPI => {
                windyMap = windyAPI;

                // 将 Windy 图层附加到 Leaflet 地图
                const windyContainer = document.querySelector('.windy-container');
                const mapContainer = document.getElementById('map');
                mapContainer.appendChild(windyContainer);

                // 同步地图视图
                map.on('move', () => {
                    if (windyMap) {
                        windyMap.map.setView([map.getCenter().lat, map.getCenter().lng], map.getZoom());
                    }
                });

                // 确保 Windy 图层加载完成
                setTimeout(() => {
                    map.invalidateSize();
                }, 500);
            });
        } else {
            // 显示 Windy 图层
            document.querySelector('.windy-container').style.display = 'block';
        }
    } else {
        // 隐藏 Windy 图层
        if (windyMap) {
            document.querySelector('.windy-container').style.display = 'none';
        }
    }
}

// 更新热力图
function updateHeatmap() {
    if (!heatmapEnabled) return;

    const intensity = parseInt(document.getElementById('heatmapIntensity').value);
    const radius = parseInt(document.getElementById('heatmapRadius').value);

    // 准备热力图数据
    const heatmapData = locationData.map(location => {
        // 根据评级给予不同的权重
        let weight = 0.5;
        switch (location.rating) {
            case 'A': weight = 1.0; break;
            case 'B': weight = 0.8; break;
            case 'C': weight = 0.6; break;
            case 'D': weight = 0.4; break;
        }
        return [location.latitude, location.longitude, weight];
    });

    // 移除现有热力图
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }

    // 添加新热力图
    if (heatmapData.length > 0) {
        heatmapLayer = L.heatLayer(heatmapData, {
            radius: radius,
            blur: 15,
            maxZoom: 17,
            max: intensity / 10,
            gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
        }).addTo(map);
    }
}

// 切换热力图显示
function toggleHeatmap() {
    heatmapEnabled = !heatmapEnabled;

    if (heatmapEnabled) {
        updateHeatmap();
    } else if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
}

// 更新统计数据
function updateStats() {
    const statsContainer = document.getElementById('statsContainer');

    // 计算各评级数量
    const ratingCounts = {
        A: 0, B: 0, C: 0, D: 0
    };

    locationData.forEach(location => {
        ratingCounts[location.rating]++;
    });

    // 计算总数
    const total = locationData.length;

    // 更新统计显示
    statsContainer.innerHTML = `
                <div class="stat-item">
                    <strong>总记录数:</strong> ${total}
                </div>
                <div class="stat-item rating-A">
                    <strong>A级数量:</strong> ${ratingCounts.A} (${total > 0 ? Math.round(ratingCounts.A / total * 100) : 0}%)
                </div>
                <div class="stat-item rating-B">
                    <strong>B级数量:</strong> ${ratingCounts.B} (${total > 0 ? Math.round(ratingCounts.B / total * 100) : 0}%)
                </div>
                <div class="stat-item rating-C">
                    <strong>C级数量:</strong> ${ratingCounts.C} (${total > 0 ? Math.round(ratingCounts.C / total * 100) : 0}%)
                </div>
                <div class="stat-item rating-D">
                    <strong>D级数量:</strong> ${ratingCounts.D} (${total > 0 ? Math.round(ratingCounts.D / total * 100) : 0}%)
                </div>
            `;
}

// 更新位置列表
function updateLocationList() {
    const locationList = document.getElementById('locationList');

    if (locationData.length === 0) {
        locationList.innerHTML = '<p>暂无位置数据</p>';
        return;
    }

    locationList.innerHTML = '';

    // 按时间倒序排列
    const sortedData = [...locationData].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedData.forEach(location => {
        const item = document.createElement('div');
        item.className = 'location-item';
        item.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <span><strong>${location.rating}级</strong> - ${location.timestamp}</span>
                        <button onclick="flyToLocation(${location.latitude}, ${location.longitude}, event)" style="padding: 2px 5px; font-size: 12px;">查看</button>
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        纬度: ${location.latitude}, 经度: ${location.longitude}
                    </div>
                `;
        locationList.appendChild(item);
    });
}

// 定位到特定位置
function flyToLocation(lat, lng, event) {
    if (event) event.stopPropagation();
    map.flyTo([lat, lng], 15);

    // 显示500米半径范围
    if (radiusCircle) {
        map.removeLayer(radiusCircle);
    }
    radiusCircle = L.circle([lat, lng], {
        radius: 500,
        color: '#0078A8',
        fillColor: '#0078A8',
        fillOpacity: 0.1
    }).addTo(map);
}

// 显示评级模态框
function showRatingModal() {
    const modal = document.getElementById('ratingModal');
    const ratingOptions = document.getElementById('ratingOptions');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmBtn');

    // 重置状态
    selectedRating = null;
    currentPosition = null;
    ratingOptions.style.display = 'none';
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('selected-rating');
    });
    document.getElementById('locationPreview').style.display = 'none';
    confirmBtn.style.display = 'none';

    // 显示模态框
    modal.style.display = 'block';
    modalMessage.textContent = '正在获取您的位置...';

    // 检查浏览器是否支持地理位置API
    if (!navigator.geolocation) {
        modalMessage.innerHTML = '<p class="error">您的浏览器不支持地理位置功能</p>';
        return;
    }

    // 请求位置信息
    navigator.geolocation.getCurrentPosition(
        function (position) {
            // 成功获取位置
            currentPosition = position;

            const latitude = position.coords.latitude.toFixed(6);
            const longitude = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            // 更新预览
            document.getElementById('previewLat').textContent = latitude;
            document.getElementById('previewLng').textContent = longitude;
            document.getElementById('previewAcc').textContent = accuracy;

            // 显示评级选项和预览
            modalMessage.textContent = '请选择此位置的评级:';
            ratingOptions.style.display = 'flex';
            document.getElementById('locationPreview').style.display = 'block';
        },
        function (error) {
            // 获取位置失败
            let errorMessage = "获取位置时出错: ";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "用户拒绝了位置请求";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "位置信息不可用";
                    break;
                case error.TIMEOUT:
                    errorMessage += "获取位置请求超时";
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage += "发生未知错误";
                    break;
            }
            modalMessage.innerHTML = `<p class="error">${errorMessage}</p>`;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// 关闭模态框
function closeModal() {
    document.getElementById('ratingModal').style.display = 'none';
}

// 选择评级
function selectRating(rating) {
    selectedRating = rating;

    // 更新UI
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('selected-rating');
    });
    event.target.classList.add('selected-rating');

    // 显示确认按钮
    document.getElementById('confirmBtn').style.display = 'inline-block';
}

// 保存带评级的位置
function saveLocationWithRating() {
    if (!currentPosition || !selectedRating) return;

    const latitude = currentPosition.coords.latitude.toFixed(6);
    const longitude = currentPosition.coords.longitude.toFixed(6);
    const accuracy = Math.round(currentPosition.coords.accuracy);
    const timestamp = new Date().toLocaleString();

    // 创建新位置对象
    const newLocation = {
        id: Date.now(), // 使用时间戳作为唯一ID
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy,
        rating: selectedRating,
        timestamp: timestamp
    };

    // 添加到数组
    locationData.push(newLocation);

    // 保存到本地存储
    localStorage.setItem('locationData', JSON.stringify(locationData));

    // 关闭模态框
    closeModal();

    // 重新加载数据
    loadLocationData();
}

// 清空所有数据
function clearStorage() {
    if (confirm('确定要清空所有位置数据吗？此操作不可撤销！')) {
        locationData = [];
        localStorage.removeItem('locationData');
        loadLocationData();

        // 清除半径圆
        if (radiusCircle) {
            map.removeLayer(radiusCircle);
            radiusCircle = null;
        }
    }
}

// 导出为Excel文件
function exportToExcel() {
    try {
        if (!locationData || locationData.length === 0) {
            alert('没有可导出的数据');
            return;
        }

        // 准备导出数据
        const exportData = locationData.map((location, index) => ({
            '序号': index + 1,
            '纬度': location.latitude,
            '经度': location.longitude,
            '精确度(米)': location.accuracy,
            '评级': location.rating,
            '时间': location.timestamp
        }));

        // 创建工作表
        const ws = XLSX.utils.json_to_sheet(exportData);

        // 创建工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "位置数据");

        // 导出文件
        const fileName = `位置评级数据_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (error) {
        console.error('导出过程中出错:', error);
        alert('导出失败: ' + error.message);
    }
}

// 从Excel导入数据
function importFromExcel() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('请选择一个文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // 假设数据在第一个工作表中
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // 将工作表转换为 JSON 数据
        const importedData = XLSX.utils.sheet_to_json(sheet);

        // 验证数据格式
        if (!validateImportedData(importedData)) {
            alert('数据格式不正确，请确保包含 "纬度", "经度", "评级" 列');
            return;
        }

        // 将数据添加到本地存储
        importedData.forEach(item => {
            const newLocation = {
                id: Date.now() + Math.random(), // 确保唯一性
                latitude: parseFloat(item['纬度']),
                longitude: parseFloat(item['经度']),
                rating: item['评级'],
                timestamp: new Date().toLocaleString()
            };
            locationData.push(newLocation);
        });

        // 保存到本地存储
        localStorage.setItem('locationData', JSON.stringify(locationData));

        // 重新加载地图数据
        loadLocationData();
        alert('数据导入成功！');
    };

    reader.readAsArrayBuffer(file);
}

// 验证导入数据的格式
function validateImportedData(data) {
    return data.every(item => '纬度' in item && '经度' in item && '评级' in item);
}

// 初始化地图和UI
document.addEventListener('DOMContentLoaded', function () {
    initMap();
    updateToggleButtons();
});

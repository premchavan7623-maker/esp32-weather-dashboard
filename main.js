import './style.css';
import Chart from 'chart.js/auto';

// ThingSpeak configuration
const CHANNEL_ID = '3527920';
const READ_API_KEY = '95RUMAMI0MV2QMGF';
const THINGSPEAK_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;
const THINGSPEAK_HISTORY_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=20`;

// DOM Elements
const disconnectAlert = document.getElementById('disconnect-alert');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const lastUpdatedEl = document.getElementById('last-updated');
const dashboardContent = document.getElementById('dashboard-content');

// Value Elements
const tempVal = document.getElementById('temp-val');
const tempBar = document.getElementById('temp-bar');
const humVal = document.getElementById('hum-val');
const humStatus = document.getElementById('hum-status');
const aqiVal = document.getElementById('aqi-val');
const aqiStatus = document.getElementById('aqi-status');
const mqVal = document.getElementById('mq-val');

// State
let isConnected = null; // null: initial, true: connected, false: disconnected
let lastFetchTime = null;

// Initialize Chart
const ctx = document.getElementById('trendChart').getContext('2d');
Chart.defaults.color = '#94A3B8';
Chart.defaults.font.family = "'Inter', sans-serif";

const trendChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
                yAxisID: 'y'
            },
            {
                label: 'Humidity (%)',
                data: [],
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
                yAxisID: 'y1'
            },
            {
                label: 'Air Quality (%)',
                data: [],
                borderColor: '#10B981',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                borderDash: [5, 5],
                yAxisID: 'y1'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#F8FAFC',
                bodyColor: '#F8FAFC',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 10
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    maxTicksLimit: 8
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                title: { display: true, text: 'Temp (°C)' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                min: 0,
                max: 100,
                title: { display: true, text: '%' }
            }
        }
    }
});

// Update UI logic
function updateDashboardUI(data) {
    const { temperature, humidity, airQualityPct, rawADC, status } = data;
    
    // Temp
    tempVal.textContent = temperature.toFixed(1);
    const tempPercent = Math.min(Math.max((temperature + 10) / 60 * 100, 0), 100); // -10 to 50 scale
    tempBar.style.width = `${tempPercent}%`;
    tempBar.style.backgroundColor = temperature > 30 ? '#EF4444' : temperature < 10 ? '#3B82F6' : '#10B981';

    // Humidity
    humVal.textContent = humidity.toFixed(1);
    if (humidity < 30) {
        humStatus.textContent = 'Dry';
        humStatus.className = 'badge badge-yellow';
    } else if (humidity > 60) {
        humStatus.textContent = 'High';
        humStatus.className = 'badge badge-blue';
    } else {
        humStatus.textContent = 'Ideal';
        humStatus.className = 'badge badge-green';
    }

    // AQI
    aqiVal.textContent = airQualityPct.toFixed(1);
    aqiStatus.textContent = status || 'Unknown'; // Use status from ESP32 payload
    if (airQualityPct > 80) {
        aqiStatus.className = 'badge badge-green';
    } else if (airQualityPct > 60) {
        aqiStatus.className = 'badge badge-yellow';
    } else if (airQualityPct > 40) {
        aqiStatus.className = 'badge badge-orange';
    } else if (airQualityPct > 20) {
        aqiStatus.className = 'badge badge-red';
    } else {
        aqiStatus.className = 'badge badge-purple';
    }

    // MQ-135
    mqVal.textContent = Math.round(rawADC);

    // Update Chart
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    trendChart.data.labels.push(timeStr);
    trendChart.data.datasets[0].data.push(temperature);
    trendChart.data.datasets[1].data.push(humidity);
    trendChart.data.datasets[2].data.push(airQualityPct);

    // Keep last 20 points
    if (trendChart.data.labels.length > 20) {
        trendChart.data.labels.shift();
        trendChart.data.datasets.forEach(dataset => dataset.data.shift());
    }
    trendChart.update();
}

function handleConnect() {
    if (isConnected !== true) {
        isConnected = true;
        disconnectAlert.classList.add('hidden');
        statusBadge.className = 'status-badge connected';
        statusText.textContent = 'Connected / Live';
        dashboardContent.classList.remove('stale');
    }
    lastFetchTime = Date.now();
    updateLastUpdatedText();
}

function handleDisconnect() {
    if (isConnected !== false) {
        isConnected = false;
        disconnectAlert.classList.remove('hidden');
        statusBadge.className = 'status-badge disconnected';
        statusText.textContent = 'Offline — Retrying...';
        dashboardContent.classList.add('stale');
    }
}

function updateLastUpdatedText() {
    if (!lastFetchTime) return;
    const diffSeconds = Math.floor((Date.now() - lastFetchTime) / 1000);
    if (isConnected) {
        lastUpdatedEl.textContent = diffSeconds === 0 ? 'Just now' : `${diffSeconds} seconds ago`;
    } else {
        lastUpdatedEl.textContent = `Disconnected for ${diffSeconds}s`;
    }
}

// Ensure the timestamp text updates every second
setInterval(updateLastUpdatedText, 1000);

// Set to true to test the UI without real ESP32
let useMock = false; 

function getMockData() {
    return {
        temperature: 22.5 + (Math.random() * 2 - 1),
        humidity: 45.2 + (Math.random() * 5 - 2.5),
        airQualityPct: 85.0 - (Math.random() * 10),
        rawADC: 800 + Math.random() * 50,
        status: "Good"
    };
}

async function fetchThingSpeakData() {
    if (useMock) {
        updateDashboardUI(getMockData());
        handleConnect();
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(THINGSPEAK_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("HTTP Error");

        const tsData = await response.json();
        
        const airQuality = parseFloat(tsData.field3) || 0;
        let derivedStatus = 'Unknown';
        if (airQuality > 80) derivedStatus = 'Excellent';
        else if (airQuality > 60) derivedStatus = 'Good';
        else if (airQuality > 40) derivedStatus = 'Moderate';
        else if (airQuality > 20) derivedStatus = 'Poor';
        else derivedStatus = 'Hazardous';

        const data = {
            temperature: parseFloat(tsData.field1) || 0,
            humidity: parseFloat(tsData.field2) || 0,
            airQualityPct: airQuality,
            rawADC: parseInt(tsData.field4) || 0,
            status: derivedStatus
        };

        updateDashboardUI(data);
        handleConnect();
    } catch (error) {
        console.warn("ThingSpeak Fetch Error:", error.message);
        handleDisconnect();
    }
}

async function fetchThingSpeakHistory() {
    try {
        const response = await fetch(THINGSPEAK_HISTORY_URL);
        if (!response.ok) throw new Error("HTTP Error");
        
        const historyData = await response.json();
        const feeds = historyData.feeds || [];
        
        // Clear existing chart data
        trendChart.data.labels = [];
        trendChart.data.datasets[0].data = [];
        trendChart.data.datasets[1].data = [];
        trendChart.data.datasets[2].data = [];

        feeds.forEach(tsData => {
            const timeStr = new Date(tsData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            trendChart.data.labels.push(timeStr);
            trendChart.data.datasets[0].data.push(parseFloat(tsData.field1) || 0);
            trendChart.data.datasets[1].data.push(parseFloat(tsData.field2) || 0);
            trendChart.data.datasets[2].data.push(parseFloat(tsData.field3) || 0);
        });
        
        trendChart.update();
    } catch (error) {
        console.warn("Failed to load historical data:", error);
    }
}

// Start polling (ThingSpeak free tier rate limit is 15s)
setInterval(fetchThingSpeakData, 15000);

// Initial Load Sequence
async function initializeDashboard() {
    await fetchThingSpeakHistory(); // Load history first to fill the chart instantly
    fetchThingSpeakData(); // Then get the latest reading to update the cards
}

initializeDashboard();

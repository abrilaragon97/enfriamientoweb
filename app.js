/* ----------------------------------------------------
   Celsius & Bites - Main JavaScript Logic
   Includes: Particle System, Chart.js, API client, & Sim Manager
   ---------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- State Variables ---
    let isRunning = false;
    let currentTime = 0.0; // in minutes
    let speedMultiplier = 1.0;
    
    // Sliders & Coefficients
    let T0 = parseFloat(document.getElementById('input-t0').value);
    let Tm = parseFloat(document.getElementById('input-tm').value);
    let k = parseFloat(document.getElementById('input-k').value);
    let currentTemp = T0;
    
    // Selected Food
    let currentFood = 'pizza';
    
    // Chart Object
    let coolingChart = null;
    
    // Steam Animation Frame ID
    let animationFrameId = null;
    
    // Presets for Food Items
    const foodPresets = {
        pizza: { T0: 85, Tm: 21, k: 0.075 },
        chicken: { T0: 90, Tm: 21, k: 0.045 },
        soup: { T0: 95, Tm: 21, k: 0.022 }
    };

    // --- DOM Elements ---
    const body = document.body;
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const foodButtons = document.querySelectorAll('.food-btn');
    const foodSvgs = document.querySelectorAll('.food-svg');
    
    const inputT0 = document.getElementById('input-t0');
    const inputTm = document.getElementById('input-tm');
    const inputK = document.getElementById('input-k');
    
    const valT0 = document.getElementById('val-t0');
    const valTm = document.getElementById('val-tm');
    const valK = document.getElementById('val-k');
    
    const btnPlay = document.getElementById('btn-play');
    const btnReset = document.getElementById('btn-reset');
    const speedButtons = document.querySelectorAll('.speed-btn');
    
    // Metrics display
    const liveTempDisplay = document.getElementById('live-temp-display');
    const metricTime = document.getElementById('metric-time');
    const metricRate = document.getElementById('metric-rate');
    const metricAmbient = document.getElementById('metric-ambient');
    const thermalGlow = document.getElementById('thermal-glow');
    
    // Math containers
    const pythonSnippetDisplay = document.getElementById('python-snippet-display');
    const eqOde = document.getElementById('eq-ode');
    const eqStep1 = document.getElementById('eq-step-1');
    const eqStep2 = document.getElementById('eq-step-2');
    const eqStep3 = document.getElementById('eq-step-3');
    const eqStep4 = document.getElementById('eq-step-4');
    const eqStep5 = document.getElementById('eq-step-5');
    const eqParticularEval = document.getElementById('eq-particular-eval');
    
    // --- Canvas Steam Particle System ---
    const canvas = document.getElementById('steam-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            // Emitting particles around the center food coordinates
            this.x = canvas.width / 2 + (Math.random() - 0.5) * 80;
            // Emit slightly above the bottom food line
            this.y = canvas.height - 110 + (Math.random() - 0.5) * 15;
            this.radius = Math.random() * 8 + 4;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = -(Math.random() * 0.8 + 0.4);
            this.maxLife = Math.random() * 100 + 80;
            this.life = this.maxLife;
            // Higher temperatures make faster-moving steam
            const heatRatio = Math.max(0, (currentTemp - Tm) / (100 - Tm));
            this.vy *= (1.0 + heatRatio * 1.5);
            this.vx *= (1.0 + heatRatio * 0.5);
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life--;
            
            // Wobble slightly as steam rises
            this.vx += (Math.random() - 0.5) * 0.05;
            
            // Expand as it rises and cools
            this.radius += 0.08;
            
            if (this.life <= 0 || this.y < 20) {
                this.reset();
            }
        }
        
        draw() {
            // Calculate opacity based on life left and temperature diff
            const lifeRatio = this.life / this.maxLife;
            const tempDiff = currentTemp - Tm;
            
            if (tempDiff <= 1) return; // No steam if food is at room temperature
            
            // Steam opacity scales with temperature difference
            const maxOpacity = Math.min(0.2, tempDiff / 80);
            let opacity = lifeRatio * maxOpacity;
            
            // Fade out near the top
            if (this.y < 120) {
                opacity *= (this.y - 20) / 100;
            }
            
            ctx.beginPath();
            // Gradient for soft steam cloud look
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0, `rgba(240, 240, 245, ${opacity})`);
            grad.addColorStop(0.5, `rgba(220, 220, 230, ${opacity * 0.4})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = grad;
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Initialize particle pool
    function initParticles() {
        particles = [];
        for (let i = 0; i < 40; i++) {
            particles.push(new Particle());
        }
    }
    
    function animateSteam() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Steam density is proportional to temperature delta
        const tempDiff = currentTemp - Tm;
        const particleCountToDraw = Math.min(particles.length, Math.floor(tempDiff * 0.6));
        
        for (let i = 0; i < particleCountToDraw; i++) {
            particles[i].update();
            particles[i].draw();
        }
        
        animationFrameId = requestAnimationFrame(animateSteam);
    }

    // --- Tab Switcher Logic ---
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Trigger chart update or math typesetting when switching tabs
            if (tabId === 'simulation-tab') {
                setTimeout(() => coolingChart.update('none'), 100);
            }
        });
    });

    // --- Food Selection Preset Appliers ---
    foodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            foodButtons.forEach(b => b.classList.remove('active'));
            foodSvgs.forEach(svg => svg.classList.remove('active'));
            
            btn.classList.add('active');
            currentFood = btn.getAttribute('data-food');
            
            // Switch body theme class
            body.className = '';
            body.classList.add(`food-${currentFood}`);
            
            // Show corresponding SVG
            const targetSvg = document.getElementById(`svg-${currentFood}`);
            if (targetSvg) targetSvg.classList.add('active');
            
            // Apply food thermodynamic presets
            const preset = foodPresets[currentFood];
            if (preset) {
                inputT0.value = preset.T0;
                inputTm.value = preset.Tm;
                inputK.value = preset.k;
                
                // Trigger slider updates
                updateParamsFromSliders();
                resetSimulation();
                fetchSymbolicSolution();
            }
        });
    });

    // --- Thermodynamics Calculations ---
    
    // Newton's Analytical Solution: T(t) = Tm + (T0 - Tm) * e^(-kt)
    function calculateTempAt(t) {
        return Tm + (T0 - Tm) * Math.exp(-k * t);
    }
    
    // dT/dt = -k(T - Tm)
    function calculateCoolingRate(temp) {
        return -k * (temp - Tm);
    }

    // --- Dynamic UI State Updates ---
    function updateParamsFromSliders() {
        T0 = parseFloat(inputT0.value);
        Tm = parseFloat(inputTm.value);
        k = parseFloat(inputK.value);
        
        valT0.textContent = `${T0.toFixed(0)}°C`;
        valTm.textContent = `${Tm.toFixed(0)}°C`;
        valK.textContent = `${k.toFixed(3)} min⁻¹`;
        
        metricAmbient.innerHTML = `${Tm.toFixed(0)} <small>°C</small>`;
        
        // Clamp slider constraints dynamically
        if (T0 < Tm) {
            // Hot food shouldn't start below ambient!
            inputT0.value = Tm;
            T0 = Tm;
            valT0.textContent = `${T0.toFixed(0)}°C`;
        }
        
        // If not running, synchronize current state
        if (!isRunning && currentTime === 0.0) {
            currentTemp = T0;
            updateMetricsDisplay();
        }
        
        // Regenerate chart reference values
        updateChartData();
    }
    
    function updateMetricsDisplay() {
        // Temperature Badge
        liveTempDisplay.textContent = `${currentTemp.toFixed(1)}°C`;
        
        // Time
        metricTime.innerHTML = `${currentTime.toFixed(1)} <small>min</small>`;
        
        // Cooling Rate
        const rate = calculateCoolingRate(currentTemp);
        const rateElement = document.getElementById('metric-rate');
        
        metricRate.innerHTML = `${rate.toFixed(2)} <small>°C/min</small>`;
        
        // Color coding cooling rate (blue when cooled down, red when cooling rapidly)
        if (Math.abs(rate) < 0.1) {
            rateElement.classList.add('cooled');
        } else {
            rateElement.classList.remove('cooled');
        }
        
        // Interactive Thermal Glow Intensity
        // Glow opacity and sizing depends on the heating delta
        const delta = currentTemp - Tm;
        const maxDelta = 100 - Tm;
        const ratio = Math.max(0, Math.min(1, delta / maxDelta));
        
        thermalGlow.style.opacity = (ratio * 0.75).toString();
        thermalGlow.style.transform = `translateY(15px) scale(${0.7 + ratio * 0.5})`;
        
        // Change colors from deep red/orange (hot) to faded cool blue/transparent
        if (ratio > 0.6) {
            thermalGlow.style.filter = 'blur(45px)';
        } else if (ratio > 0.2) {
            thermalGlow.style.filter = 'blur(55px)';
        } else {
            thermalGlow.style.filter = 'blur(65px)';
        }
    }

    // --- Sliders Listeners ---
    inputT0.addEventListener('input', () => {
        updateParamsFromSliders();
        if (currentTime === 0.0) {
            currentTemp = T0;
            updateMetricsDisplay();
        }
        debouncedFetchSymbolicSolution();
    });
    inputTm.addEventListener('input', () => {
        updateParamsFromSliders();
        debouncedFetchSymbolicSolution();
    });
    inputK.addEventListener('input', () => {
        updateParamsFromSliders();
        debouncedFetchSymbolicSolution();
    });

    // Debounce backend API calls to avoid server spam on slider drags
    let fetchTimeout = null;
    function debouncedFetchSymbolicSolution() {
        clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(fetchSymbolicSolution, 300);
    }

    // --- Chart.js Setup & Implementation ---
    function initializeChart() {
        const ctxChart = document.getElementById('cooling-chart').getContext('2d');
        
        // Get initial labels representing minutes 0 to 60
        const labels = Array.from({length: 61}, (_, i) => i);
        
        coolingChart = new Chart(ctxChart, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Temperatura Alimento (°C)',
                        data: [],
                        borderColor: '#e74c3c', // default placeholder, updated dynamically
                        borderWidth: 3,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.15,
                        z: 2
                    },
                    {
                        label: 'Límite Ambiente (Tm)',
                        data: Array(61).fill(Tm),
                        borderColor: 'rgba(148, 163, 184, 0.4)',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        pointRadius: 0,
                        fill: false,
                        z: 1
                    },
                    {
                        label: 'Estado Actual',
                        data: [], // populated dynamically with 1 point
                        borderColor: '#ffffff',
                        backgroundColor: '#ffffff',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        showLine: false,
                        z: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        enabled: true
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Inter' }
                        },
                        title: {
                            display: true,
                            text: 'Tiempo (minutos)',
                            color: '#94a3b8',
                            font: { family: 'Outfit', weight: 'bold' }
                        }
                    },
                    y: {
                        min: 0,
                        max: 110,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Inter' }
                        },
                        title: {
                            display: true,
                            text: 'Temperatura (°C)',
                            color: '#94a3b8',
                            font: { family: 'Outfit', weight: 'bold' }
                        }
                    }
                }
            }
        });
        
        updateChartData();
    }
    
    function updateChartData() {
        if (!coolingChart) return;
        
        const theoreticalData = [];
        for (let t = 0; t <= 60; t++) {
            theoreticalData.push(calculateTempAt(t));
        }
        
        // Determine theme primary accent color
        const styles = getComputedStyle(body);
        const accentColor = styles.getPropertyValue('--accent').trim();
        
        // Update Chart styling & data
        coolingChart.data.datasets[0].data = theoreticalData;
        coolingChart.data.datasets[0].borderColor = accentColor;
        
        // Ambient Line
        coolingChart.data.datasets[1].data = Array(61).fill(Tm);
        
        // Current state marker point
        updateChartMarker();
        
        coolingChart.update('none'); // silent update
    }
    
    function updateChartMarker() {
        if (!coolingChart) return;
        
        // If current time is within bounds, plot it
        if (currentTime <= 60) {
            coolingChart.data.datasets[2].data = [{x: Math.round(currentTime), y: currentTemp}];
            
            // Adjust point border color to match theme accent
            const styles = getComputedStyle(body);
            coolingChart.data.datasets[2].borderColor = styles.getPropertyValue('--accent').trim();
        } else {
            coolingChart.data.datasets[2].data = [];
        }
    }

    // --- Simulation Player Control Cycle ---
    let lastTime = 0;
    
    function simulationLoop(timestamp) {
        if (!isRunning) return;
        
        if (!lastTime) lastTime = timestamp;
        const deltaMs = timestamp - lastTime;
        lastTime = timestamp;
        
        // Map real milliseconds elapsed to simulation minutes
        // Default: 1 real second = 1 simulation minute
        const minPerMs = 1.0 / 1000.0; 
        const deltaSimMinutes = deltaMs * minPerMs * speedMultiplier;
        
        currentTime += deltaSimMinutes;
        
        // Calculate food temperature dynamically using analytical solution
        currentTemp = calculateTempAt(currentTime);
        
        // Keep UI synced
        updateMetricsDisplay();
        updateChartMarker();
        coolingChart.update('none');
        
        // End simulation automatically if food reaches steady ambient state
        if (currentTemp - Tm <= 0.1 || currentTime >= 60) {
            pauseSimulation();
            currentTime = Math.min(60, currentTime);
            currentTemp = calculateTempAt(currentTime);
            updateMetricsDisplay();
            updateChartMarker();
            coolingChart.update();
            document.getElementById('chart-status').textContent = 'Terminado';
            document.getElementById('chart-status').style.color = '#2ecc71';
        } else {
            requestAnimationFrame(simulationLoop);
        }
    }
    
    function startSimulation() {
        if (isRunning) return;
        
        // If simulation already completed, reset first
        if (currentTime >= 60 || currentTemp - Tm <= 0.1) {
            resetSimulation();
        }
        
        isRunning = true;
        lastTime = 0;
        btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
        btnPlay.classList.remove('btn-primary');
        btnPlay.classList.add('btn-secondary');
        
        document.getElementById('chart-status').textContent = 'Enfriando...';
        document.getElementById('chart-status').style.color = '#f1c40f';
        
        requestAnimationFrame(simulationLoop);
    }
    
    function pauseSimulation() {
        if (!isRunning) return;
        isRunning = false;
        btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
        btnPlay.classList.remove('btn-secondary');
        btnPlay.classList.add('btn-primary');
        
        document.getElementById('chart-status').textContent = 'Pausado';
        document.getElementById('chart-status').style.color = '#3498db';
    }
    
    function resetSimulation() {
        pauseSimulation();
        currentTime = 0.0;
        currentTemp = T0;
        updateMetricsDisplay();
        updateChartData();
        
        document.getElementById('chart-status').textContent = 'Listo';
        document.getElementById('chart-status').style.color = 'var(--accent)';
    }
    
    btnPlay.addEventListener('click', () => {
        if (isRunning) {
            pauseSimulation();
        } else {
            startSimulation();
        }
    });
    
    btnReset.addEventListener('click', resetSimulation);
    
    // Speed Selector Buttons
    speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            speedMultiplier = parseFloat(btn.getAttribute('data-speed'));
        });
    });

    // --- Math Rendering with KaTeX via Flask API ---
    function fetchSymbolicSolution() {
        const url = `/api/solve?T0=${T0}&Tm=${Tm}&k=${k}`;
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Render Equations using KaTeX library
                    if (window.katex) {
                        try {
                            // Render equations
                            katex.render(`\\frac{dT}{dt} = -k(T - T_m)`, eqOde, { displayMode: true });
                            katex.render(data.steps.separable, eqStep1, { displayMode: true });
                            katex.render(data.steps.integrated, eqStep2, { displayMode: true });
                            katex.render(data.steps.general_solution, eqStep3, { displayMode: true });
                            katex.render(data.steps.initial_condition, eqStep4, { displayMode: true });
                            katex.render(data.steps.particular_solution, eqStep5, { displayMode: true });
                            katex.render(data.particular_sol_eval, eqParticularEval, { displayMode: true });
                        } catch (err) {
                            console.error("Error rendering KaTeX equation:", err);
                        }
                    }
                    // Render SymPy script
                    pythonSnippetDisplay.textContent = data.pythonSnippet;
                } else {
                    console.error("API solver failed:", data.error);
                }
            })
            .catch(err => {
                console.error("Failed to query solver API:", err);
            });
    }

    // --- Initial Boot ---
    initParticles();
    animateSteam();
    initializeChart();
    
    // Apply initial presets
    updateParamsFromSliders();
    fetchSymbolicSolution();
    
    // Handle window resize for steam canvas dimensions
    window.addEventListener('resize', () => {
        // Redraw check to maintain coordinate systems
        initParticles();
    });
});

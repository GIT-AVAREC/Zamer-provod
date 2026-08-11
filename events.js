// events.js - Обработчики событий
const EventHandler = (function() {
    'use strict';
    
    const PX_PER_METER = 46;
    let wireStart = null;
    let isDragging = false;
    let dragStart = null;
    let cameraStart = null;
    
    function init(core, renderer, calculator) {
        setupRoomForm(core);
        setupTools(core, renderer, calculator);
        setupSVGHandlers(core, renderer, calculator);
        setupZoomControls(core, renderer);
        setupActionButtons(core, renderer, calculator);
        setupSettingsAndPrices(core, calculator);
        setupExportImport(core, renderer, calculator);
        setupTheme(core, renderer);
        
        return { wireStart };
    }
    
    function setupRoomForm(core) {
        const form = document.getElementById('roomForm');
        const cancelBtn = document.getElementById('cancelEdit');
        let editRoomId = null;
        
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('rName').value.trim();
            let W = parseFloat(document.getElementById('rW').value);
            let L = parseFloat(document.getElementById('rL').value);
            let H = parseFloat(document.getElementById('rH').value) || 2.7;
            
            if (!name) return alert('Введите название');
            if (isNaN(W) || isNaN(L)) {
                // Парсинг из названия
                const parts = name.split('*').map(p => parseFloat(p.trim()));
                if (parts.length >= 2 && !isNaN(parts[0])) {
                    W = parts[0]; L = parts[1]; H = parts[2] || H;
                } else {
                    return alert('Введите размеры');
                }
            }
            
            if (editRoomId) {
                core.editRoom(editRoomId, {name, W, L, H});
                editRoomId = null;
                cancelBtn.style.display = 'none';
            } else {
                core.addRoom(name, W, L, H);
            }
            
            form.reset();
            updateUI(core);
        });
        
        cancelBtn?.addEventListener('click', () => {
            editRoomId = null;
            cancelBtn.style.display = 'none';
            form.reset();
        });
        
        // Глобальные функции для onclick в HTML
        window.selectRoom = (id) => { core.selectRoom(id); updateUI(core); };
        window.deleteRoom = (id) => {
            if (!confirm('Удалить комнату?')) return;
            core.deleteRoom(id);
            updateUI(core);
        };
        window.editRoom = (id) => {
            const room = core.getState().rooms.find(r => r.id === id);
            if (!room) return;
            editRoomId = id;
            document.getElementById('rName').value = room.name;
            document.getElementById('rW').value = room.W;
            document.getElementById('rL').value = room.L;
            document.getElementById('rH').value = room.H;
            cancelBtn.style.display = 'inline-block';
        };
        window.openBoard = () => {
            const board = document.getElementById('board');
            if (board) {
                board.classList.add('open');
                document.body.classList.add('lock');
                fitAll();
                updateUI(core);
            }
        };
        window.closeBoard = () => {
            const board = document.getElementById('board');
            if (board) {
                board.classList.remove('open');
                document.body.classList.remove('lock');
            }
        };
    }
    
    function setupTools(core, renderer, calculator) {
        const toolsContainer = document.getElementById('tools');
        toolsContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool');
            if (!btn) return;
            
            toolsContainer.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            core.setTool(btn.dataset.tool);
            wireStart = null;
            updateUI(core);
        });
    }
    
    function setupSVGHandlers(core, renderer, calculator) {
        const svg = document.getElementById('plan');
        if (!svg) return;
        
        svg.addEventListener('click', (e) => {
            const state = core.getState();
            const camera = core.getCamera();
            const tool = core.getTool();
            
            const rect = svg.getBoundingClientRect();
            const scaleX = camera.w / rect.width;
            const scaleY = camera.h / rect.height;
            const worldX = camera.x + (e.clientX - rect.left) * scaleX;
            const worldY = camera.y + (e.clientY - rect.top) * scaleY;
            
            // Проверка клика по элементу
            if (e.target.dataset?.itemId) {
                handleItemClick(core, e.target.dataset.itemId, calculator);
                return;
            }
            
            // Клик по пустому месту
            const room = core.getActiveRoom();
            if (!room) return;
            
            const rx = room.x0 * PX_PER_METER;
            const ry = room.y0 * PX_PER_METER;
            const rw = room.W * PX_PER_METER;
            const rl = room.L * PX_PER_METER;
            
            if (worldX < rx || worldX > rx + rw || worldY < ry || worldY > ry + rl) return;
            
            const mx = (worldX - rx) / PX_PER_METER;
            const my = (worldY - ry) / PX_PER_METER;
            
            if (tool === 'select' || tool === 'hand') return;
            
            if (tool === 'erase') {
                eraseNearbyItem(core, room, mx, my, calculator);
                return;
            }
            
            if (tool === 'wire') return; // Провода по клику на элементах
            
            // Добавление элемента
            const item = core.addItem(tool, mx, my);
            if (item) updateUI(core);
        });
        
        // Перетаскивание для руки
        svg.addEventListener('mousedown', (e) => {
            if (core.getTool() === 'hand') {
                isDragging = true;
                dragStart = {x: e.clientX, y: e.clientY};
                cameraStart = {...core.getCamera()};
                svg.style.cursor = 'grabbing';
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                const scale = core.getCamera().w / svg.getBoundingClientRect().width;
                const camera = core.getCamera();
                core.setCamera({
                    x: cameraStart.x - dx * scale,
                    y: cameraStart.y - dy * scale,
                    w: camera.w,
                    h: camera.h
                });
                Renderer.render(core.getState(), core.getCamera());
            }
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
            svg.style.cursor = core.getTool() === 'hand' ? 'grab' : 'crosshair';
        });
        
        // Зум колесиком
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = svg.getBoundingClientRect();
            const scale = core.getCamera().w / rect.width;
            const worldX = core.getCamera().x + (e.clientX - rect.left) * scale;
            const worldY = core.getCamera().y + (e.clientY - rect.top) * scale;
            
            const zoom = e.deltaY > 0 ? 1.2 : 0.8;
            const camera = core.getCamera();
            const newW = camera.w * zoom;
            const newH = camera.h * zoom;
            
            core.setCamera({
                x: worldX - (e.clientX - rect.left) * (newW / rect.width),
                y: worldY - (e.clientY - rect.top) * (newH / rect.height),
                w: newW,
                h: newH
            });
            
            Renderer.render(core.getState(), core.getCamera());
        });
    }
    
    function handleItemClick(core, itemId, calculator) {
        if (core.getTool() === 'wire') {
            if (!wireStart) {
                wireStart = {itemId};
                document.getElementById('tip').textContent = 'Выберите второй элемент';
            } else {
                // Создание провода
                const fromItem = findItemById(core, wireStart.itemId);
                const toItem = findItemById(core, itemId);
                
                if (fromItem && toItem) {
                    core.addWire(fromItem.roomId, wireStart.itemId, toItem.roomId, itemId);
                    wireStart = null;
                    document.getElementById('tip').textContent = 'Провод добавлен';
                }
            }
        } else if (core.getTool() === 'select') {
            core.selectedItemId = itemId;
        } else if (core.getTool() === 'erase') {
            const found = findItemById(core, itemId);
            if (found) {
                core.deleteItem(found.roomId, itemId);
                wireStart = null;
            }
        }
        
        updateUI(core);
    }
    
    function eraseNearbyItem(core, room, mx, my, calculator) {
        const items = room.items || [];
        let closest = null, minDist = 0.5;
        
        for (const item of items) {
            const dist = Math.hypot(item.x - mx, item.y - my);
            if (dist < minDist) {
                minDist = dist;
                closest = item;
            }
        }
        
        if (closest) {
            core.deleteItem(room.id, closest.id);
            updateUI(core);
        }
    }
    
    function findItemById(core, itemId) {
        for (const room of core.getState().rooms) {
            const item = (room.items || []).find(i => i.id === itemId);
            if (item) return {roomId: room.id, item};
        }
        return null;
    }
    
    function setupZoomControls(core, renderer) {
        document.getElementById('zIn')?.addEventListener('click', () => {
            const cam = core.getCamera();
            const zoom = 0.8;
            core.setCamera({
                x: cam.x + cam.w * 0.1,
                y: cam.y + cam.h * 0.1,
                w: cam.w * zoom,
                h: cam.h * zoom
            });
            renderer.render(core.getState(), core.getCamera());
        });
        
        document.getElementById('zOut')?.addEventListener('click', () => {
            const cam = core.getCamera();
            const zoom = 1.25;
            core.setCamera({
                x: cam.x - cam.w * 0.125,
                y: cam.y - cam.h * 0.125,
                w: cam.w * zoom,
                h: cam.h * zoom
            });
            renderer.render(core.getState(), core.getCamera());
        });
        
        document.getElementById('zFit')?.addEventListener('click', fitAll);
    }
    
    function fitAll() {
        const state = Provodomer.getState();
        if (!state.rooms.length) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.rooms.forEach(r => {
            minX = Math.min(minX, r.x0 * PX_PER_METER);
            minY = Math.min(minY, r.y0 * PX_PER_METER);
            maxX = Math.max(maxX, (r.x0 + r.W) * PX_PER_METER);
            maxY = Math.max(maxY, (r.y0 + r.L) * PX_PER_METER);
        });
        
        const padding = 50;
        Provodomer.setCamera({
            x: minX - padding,
            y: minY - padding,
            w: maxX - minX + padding * 2,
            h: maxY - minY + padding * 2
        });
        
        Renderer.render(Provodomer.getState(), Provodomer.getCamera());
    }
    
    function setupActionButtons(core, renderer, calculator) {
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            core.undo();
            updateUI(core);
        });
        
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            const room = core.getActiveRoom();
            if (!room) return;
            if (!confirm('Очистить комнату?')) return;
            core.clearRoom(room.id);
            updateUI(core);
        });
    }
    
    function setupSettingsAndPrices(core, calculator) {
        const settings = ['reserve', 'pct', 'outlet', 'switchh', 'cookH', 'boxOff', 'acOff', 'panel'];
        const ids = ['sReserve', 'sPct', 'sOutlet', 'sSwitch', 'sCookH', 'sBoxOff', 'sAcOff', 'sPanel'];
        
        ids.forEach((id, i) => {
            document.getElementById(id)?.addEventListener('change', function() {
                core.getState().settings[settings[i]] = parseFloat(this.value) || 0;
                Provodomer.saveState();
                updateUI(core);
            });
        });
        
        const priceIds = ['pC15', 'pC25', 'pC4', 'pC6'];
        const priceKeys = [1.5, 2.5, 4, 6];
        
        priceIds.forEach((id, i) => {
            document.getElementById(id)?.addEventListener('change', function() {
                core.getState().prices.cab[priceKeys[i]] = parseFloat(this.value) || 0;
                Provodomer.saveState();
                updateUI(core);
            });
        });
    }
    
    function setupExportImport(core, renderer, calculator) {
        document.getElementById('expBtn')?.addEventListener('click', () => {
            const json = core.exportProject();
            const blob = new Blob([json], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'provodomer.json';
            a.click();
            URL.revokeObjectURL(url);
        });
        
        document.getElementById('impBtn')?.addEventListener('click', () => {
            document.getElementById('impFile').click();
        });
        
        document.getElementById('impFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (core.importProject(ev.target.result)) {
                    updateUI(core);
                    alert('Проект загружен!');
                } else {
                    alert('Ошибка загрузки');
                }
            };
            reader.readAsText(file);
        });
    }
    
    function setupTheme(core, renderer) {
        const saved = localStorage.getItem('provodomer_theme') || 'dark';
        setTheme(saved);
        
        document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
        document.getElementById('themeBtn2')?.addEventListener('click', toggleTheme);
    }
    
    function setTheme(t) {
        document.documentElement.dataset.theme = t;
        const icon = t === 'light' ? '🌙' : '☀️';
        document.getElementById('themeBtn').textContent = icon;
        document.getElementById('themeBtn2').textContent = icon;
        localStorage.setItem('provodomer_theme', t);
    }
    
    function toggleTheme() {
        const current = document.documentElement.dataset.theme;
        setTheme(current === 'dark' ? 'light' : 'dark');
    }
    
    function updateUI(core) {
        Renderer.render(core.getState(), core.getCamera());
        Calculator.calculate(core.getState());
        updateRoomList(core);
    }
    
    function updateRoomList(core) {
        const ul = document.getElementById('roomList');
        if (!ul) return;
        
        const state = core.getState();
        ul.innerHTML = state.rooms.map(r => `
            <li class="room${r.id === state.activeRoomId ? ' active' : ''}" 
                onclick="selectRoom('${r.id}')">
                <div class="rmain">
                    <div class="rname">${r.name}</div>
                    <div class="rdims">${r.W}×${r.L}×${r.H} м</div>
                </div>
                <button class="ibtn" onclick="event.stopPropagation();editRoom('${r.id}')">✎</button>
                <button class="ibtn del" onclick="event.stopPropagation();deleteRoom('${r.id}')">🗑</button>
            </li>
        `).join('');
        
        const count = document.getElementById('roomsCount');
        if (count) count.textContent = `(${state.rooms.length})`;
        
        const tip = document.getElementById('tip');
        const room = core.getActiveRoom();
        if (tip && room) {
            tip.textContent = `${room.name} | ${room.W}×${room.L} м`;
        }
        
        const bRoom = document.getElementById('bRoom');
        if (bRoom && room) bRoom.textContent = room.name;
    }
    
    return { init };
})();
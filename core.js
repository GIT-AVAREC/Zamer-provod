// core.js - Ядро Проводомера
const Provodomer = (function() {
    'use strict';
    
    // Константы
    const LS_KEY = 'provodomer_v8';
    const PX_PER_METER = 46;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    
    // Цвета элементов
    const COLORS = {
        'Р': '#22d3ee', 'В': '#a78bfa', 'Л': '#34d399', 
        'П': '#fb923c', 'С': '#60a5fa', 'К': '#fbbf24', 
        'Щ': '#f87171', 'Д': '#d4a373', 'О': '#7dd3fc'
    };
    
    // Сечения кабелей
    const SECTIONS = {'Л': 1.5, 'В': 1.5, 'Р': 2.5, 'С': 2.5, 'П': 6};
    
    // Состояние
    let state = {
        rooms: [],
        activeRoomId: null,
        wires: [],
        settings: {
            reserve: 20, pct: 10, outlet: 30, switchh: 90,
            cookH: 15, boxOff: 20, acOff: 30, panel: 150
        },
        prices: {
            cab: {1.5: 90, 2.5: 140, 4: 220, 6: 330},
            brk: 250, rcd: 1800, panel: 2500, podroz: 15, korob: 20
        }
    };
    
    let currentTool = 'select';
    let selectedItemId = null;
    let wireStart = null;
    let history = [];
    let camera = {x: 0, y: 0, w: 600, h: 400, scale: 1};
    
    // Утилиты
    const $ = (id) => document.getElementById(id);
    const uid = () => Math.random().toString(36).substr(2, 9);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const fmt = (n) => Math.round(n * 100) / 100;
    const money = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
    
    // API модуля
    const api = {
        init,
        getState: () => state,
        getActiveRoom,
        getCamera: () => camera,
        addRoom,
        deleteRoom,
        selectRoom,
        editRoom,
        addItem,
        deleteItem,
        addWire,
        deleteWire,
        clearRoom,
        undo,
        exportProject,
        importProject,
        setTool,
        getTool: () => currentTool,
        setCamera,
        snapToWall,
        calculate
    };
    
    // Инициализация
    function init() {
        loadState();
        loadSettingsToForm();
        loadPricesToForm();
        
        if (!state.rooms.length) createDemoData();
        if (!state.activeRoomId && state.rooms.length) {
            state.activeRoomId = state.rooms[0].id;
        }
        
        saveState();
        return api;
    }
    
    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(LS_KEY));
            if (saved) {
                state = {...state, ...saved};
                state.settings = {...state.settings, ...saved.settings};
                state.prices = {...state.prices, ...saved.prices};
                if (saved.prices?.cab) {
                    state.prices.cab = {...state.prices.cab, ...saved.prices.cab};
                }
            }
        } catch(e) {
            console.warn('Failed to load state:', e);
        }
    }
    
    function saveState() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        } catch(e) {
            console.error('Failed to save state:', e);
        }
    }
    
    function createDemoData() {
        const id1 = uid(), id2 = uid();
        state.rooms = [
            {
                id: id1, name: 'Гостиная', W: 4, L: 5, H: 2.7, x0: 0, y0: 0,
                items: [
                    {id: uid(), type: 'Щ', x: 0.5, y: 0},
                    {id: uid(), type: 'К', x: 2, y: 0},
                    {id: uid(), type: 'Р', x: 4, y: 0.5},
                    {id: uid(), type: 'Р', x: 4, y: 2.5},
                    {id: uid(), type: 'В', x: 3, y: 5},
                    {id: uid(), type: 'Л', x: 2, y: 2.5},
                    {id: uid(), type: 'Д', x: 1.5, y: 5, w: 0.9, h: 2.1},
                    {id: uid(), type: 'О', x: 0, y: 1.5, w: 1.5, h: 1.4}
                ]
            },
            {
                id: id2, name: 'Кухня', W: 3, L: 4, H: 2.7, x0: 4.5, y0: 0,
                items: [
                    {id: uid(), type: 'К', x: 1.5, y: 0},
                    {id: uid(), type: 'П', x: 0.5, y: 2},
                    {id: uid(), type: 'С', x: 3, y: 1},
                    {id: uid(), type: 'Р', x: 3, y: 0.5},
                    {id: uid(), type: 'Л', x: 1.5, y: 2},
                    {id: uid(), type: 'О', x: 1.5, y: 4, w: 1.4, h: 1.3}
                ]
            }
        ];
        state.activeRoomId = id1;
    }
    
    function getActiveRoom() {
        return state.rooms.find(r => r.id === state.activeRoomId) || null;
    }
    
    function addRoom(name, W, L, H) {
        let x0 = 0, y0 = 0;
        if (state.rooms.length) {
            const last = state.rooms[state.rooms.length - 1];
            x0 = last.x0 + last.W + 0.5;
            y0 = last.y0;
        }
        
        const room = {id: uid(), name, W, L, H, x0, y0, items: []};
        state.rooms.push(room);
        state.activeRoomId = room.id;
        saveState();
        return room;
    }
    
    function deleteRoom(id) {
        state.rooms = state.rooms.filter(r => r.id !== id);
        state.wires = state.wires.filter(w => w.fromRoomId !== id && w.toRoomId !== id);
        if (state.activeRoomId === id) {
            state.activeRoomId = state.rooms.length ? state.rooms[0].id : null;
        }
        saveState();
    }
    
    function selectRoom(id) {
        state.activeRoomId = id;
        selectedItemId = null;
        wireStart = null;
        saveState();
    }
    
    function editRoom(id, updates) {
        const room = state.rooms.find(r => r.id === id);
        if (room) {
            Object.assign(room, updates);
            saveState();
        }
    }
    
    function addItem(type, x, y, extras = {}) {
        const room = getActiveRoom();
        if (!room) return null;
        
        const snap = snapToWall(x, y, room.W, room.L);
        const item = {
            id: uid(),
            type,
            x: clamp(snap.x, 0, room.W),
            y: clamp(snap.y, 0, room.L),
            ...extras
        };
        
        if (type === 'Д' && !item.w) Object.assign(item, {w: 0.9, h: 2.1});
        if (type === 'О' && !item.w) Object.assign(item, {w: 1.5, h: 1.4});
        
        if (!room.items) room.items = [];
        room.items.push(item);
        saveState();
        return item;
    }
    
    function deleteItem(roomId, itemId) {
        const room = state.rooms.find(r => r.id === roomId);
        if (room) {
            room.items = (room.items || []).filter(i => i.id !== itemId);
            state.wires = state.wires.filter(w => 
                !(w.fromRoomId === roomId && w.fromItemId === itemId) &&
                !(w.toRoomId === roomId && w.toItemId === itemId)
            );
            if (selectedItemId === itemId) selectedItemId = null;
            saveState();
        }
    }
    
    function addWire(fromRoomId, fromItemId, toRoomId, toItemId) {
        const fromRoom = state.rooms.find(r => r.id === fromRoomId);
        const toRoom = state.rooms.find(r => r.id === toRoomId);
        if (!fromRoom || !toRoom) return null;
        
        const fromItem = (fromRoom.items || []).find(i => i.id === fromItemId);
        const toItem = (toRoom.items || []).find(i => i.id === toItemId);
        if (!fromItem || !toItem) return null;
        
        const type = fromItem.type !== 'К' && fromItem.type !== 'Щ' ? fromItem.type : toItem.type;
        
        const wire = {
            id: uid(),
            fromRoomId,
            fromItemId,
            toRoomId,
            toItemId,
            type
        };
        
        state.wires.push(wire);
        saveState();
        return wire;
    }
    
    function clearRoom(roomId) {
        const room = state.rooms.find(r => r.id === roomId);
        if (room) {
            room.items = [];
            state.wires = state.wires.filter(w => w.fromRoomId !== roomId && w.toRoomId !== roomId);
            saveState();
        }
    }
    
    function undo() {
        if (!history.length) return;
        const prev = history.pop();
        state = {...state, ...prev};
        saveState();
    }
    
    function pushHistory() {
        history.push(JSON.parse(JSON.stringify({rooms: state.rooms, wires: state.wires})));
        if (history.length > 50) history.shift();
    }
    
    function exportProject() {
        return JSON.stringify(state, null, 2);
    }
    
    function importProject(json) {
        try {
            const data = JSON.parse(json);
            if (data.rooms && Array.isArray(data.rooms)) {
                state = {...state, ...data};
                state.settings = {...state.settings, ...data.settings};
                state.prices = {...state.prices, ...data.prices};
                if (data.prices?.cab) {
                    state.prices.cab = {...state.prices.cab, ...data.prices.cab};
                }
                saveState();
                return true;
            }
        } catch(e) {
            console.error('Import failed:', e);
        }
        return false;
    }
    
    function setTool(tool) {
        currentTool = tool;
        selectedItemId = null;
        wireStart = null;
    }
    
    function setCamera(cam) {
        Object.assign(camera, cam);
    }
    
    function snapToWall(x, y, W, L) {
        const dists = [
            {dist: y, wall: 'top', x, y: 0},
            {dist: W - x, wall: 'right', x: W, y},
            {dist: L - y, wall: 'bottom', x, y: L},
            {dist: x, wall: 'left', x: 0, y}
        ];
        dists.sort((a, b) => a.dist - b.dist);
        return {x: dists[0].x, y: dists[0].y};
    }
    
    function calculate() {
        // Расчеты будут в отдельном модуле
        return calculateAll(state);
    }
    
    return api;
})();
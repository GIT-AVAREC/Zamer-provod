// renderer.js - SVG рендерер
const Renderer = (function() {
    'use strict';
    
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const PX_PER_METER = 46;
    
    const COLORS = {
        'Р': '#22d3ee', 'В': '#a78bfa', 'Л': '#34d399', 
        'П': '#fb923c', 'С': '#60a5fa', 'К': '#fbbf24', 
        'Щ': '#f87171', 'Д': '#d4a373', 'О': '#7dd3fc'
    };
    
    function render(state, camera, selectedItemId) {
        const svg = document.getElementById('plan');
        if (!svg) return;
        
        // Очистка
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        
        // Обновление viewBox
        svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
        
        // Сетка
        renderGrid(svg, camera);
        
        // Комнаты и элементы
        state.rooms.forEach(room => {
            renderRoom(svg, room, state.activeRoomId, selectedItemId);
        });
        
        // Провода
        renderWires(svg, state, selectedItemId);
    }
    
    function renderGrid(svg, camera) {
        const group = createSVGElement('g');
        group.setAttribute('stroke', '#2a3040');
        group.setAttribute('stroke-width', '0.5');
        group.setAttribute('opacity', '0.3');
        
        const step = PX_PER_METER;
        const startX = Math.floor(camera.x / step) * step;
        const startY = Math.floor(camera.y / step) * step;
        
        for (let x = startX; x < camera.x + camera.w; x += step) {
            const line = createSVGElement('line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', camera.y);
            line.setAttribute('x2', x);
            line.setAttribute('y2', camera.y + camera.h);
            group.appendChild(line);
        }
        
        for (let y = startY; y < camera.y + camera.h; y += step) {
            const line = createSVGElement('line');
            line.setAttribute('x1', camera.x);
            line.setAttribute('y1', y);
            line.setAttribute('x2', camera.x + camera.w);
            line.setAttribute('y2', y);
            group.appendChild(line);
        }
        
        svg.appendChild(group);
    }
    
    function renderRoom(svg, room, activeRoomId, selectedItemId) {
        const g = createSVGElement('g');
        const isActive = room.id === activeRoomId;
        
        const rx = room.x0 * PX_PER_METER;
        const ry = room.y0 * PX_PER_METER;
        const rw = room.W * PX_PER_METER;
        const rl = room.L * PX_PER_METER;
        
        // Прямоугольник комнаты
        const rect = createSVGElement('rect');
        rect.setAttribute('x', rx);
        rect.setAttribute('y', ry);
        rect.setAttribute('width', rw);
        rect.setAttribute('height', rl);
        rect.setAttribute('fill', isActive ? '#1a2744' : '#111827');
        rect.setAttribute('stroke', isActive ? '#fbbf24' : '#374151');
        rect.setAttribute('stroke-width', isActive ? '2' : '1');
        rect.setAttribute('rx', '4');
        g.appendChild(rect);
        
        // Название
        const text = createSVGElement('text');
        text.setAttribute('x', rx + rw/2);
        text.setAttribute('y', ry + rl/2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#9ca3af');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('opacity', '0.5');
        text.textContent = room.name;
        g.appendChild(text);
        
        // Размеры
        renderDimensions(g, room, rx, ry, rw, rl);
        
        // Элементы
        (room.items || []).forEach(item => {
            renderItem(g, item, room, rx, ry, selectedItemId);
        });
        
        svg.appendChild(g);
    }
    
    function renderDimensions(g, room, rx, ry, rw, rl) {
        // Ширина
        const wText = createSVGElement('text');
        wText.setAttribute('x', rx + rw/2);
        wText.setAttribute('y', ry - 8);
        wText.setAttribute('text-anchor', 'middle');
        wText.setAttribute('fill', '#6b7280');
        wText.setAttribute('font-size', '10');
        wText.textContent = room.W + ' м';
        g.appendChild(wText);
        
        // Длина
        const lText = createSVGElement('text');
        lText.setAttribute('x', rx + rw + 12);
        lText.setAttribute('y', ry + rl/2);
        lText.setAttribute('text-anchor', 'middle');
        lText.setAttribute('fill', '#6b7280');
        lText.setAttribute('font-size', '10');
        lText.textContent = room.L + ' м';
        g.appendChild(lText);
    }
    
    function renderItem(g, item, room, rx, ry, selectedItemId) {
        const ix = rx + item.x * PX_PER_METER;
        const iy = ry + item.y * PX_PER_METER;
        const isSelected = item.id === selectedItemId;
        
        if (item.type === 'Д' || item.type === 'О') {
            renderDoorWindow(g, item, room, ix, iy, isSelected);
        } else {
            renderPoint(g, item, ix, iy, isSelected);
        }
    }
    
    function renderDoorWindow(g, item, room, ix, iy, isSelected) {
        const w = (item.w || 0.9) * PX_PER_METER;
        
        // Определяем ориентацию
        const snap = snapToWallPoint(item.x, item.y, room.W, room.L);
        let x1, y1, x2, y2;
        
        switch(snap.wall) {
            case 'top':
                x1 = ix - w/2; y1 = iy; x2 = ix + w/2; y2 = iy;
                break;
            case 'right':
                x1 = ix; y1 = iy - w/2; x2 = ix; y2 = iy + w/2;
                break;
            case 'bottom':
                x1 = ix - w/2; y1 = iy; x2 = ix + w/2; y2 = iy;
                break;
            case 'left':
                x1 = ix; y1 = iy - w/2; x2 = ix; y2 = iy + w/2;
                break;
        }
        
        const color = item.type === 'Д' ? '#d4a373' : '#7dd3fc';
        
        const line = createSVGElement('line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', isSelected ? '6' : '4');
        line.setAttribute('stroke-linecap', 'round');
        line.style.cursor = 'pointer';
        line.dataset.itemId = item.id;
        g.appendChild(line);
    }
    
    function renderPoint(g, item, ix, iy, isSelected) {
        const r = (item.type === 'К' || item.type === 'Щ') ? 7 : 5;
        
        const circle = createSVGElement('circle');
        circle.setAttribute('cx', ix);
        circle.setAttribute('cy', iy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', COLORS[item.type] || '#fff');
        circle.setAttribute('stroke', isSelected ? '#fbbf24' : '#1f2937');
        circle.setAttribute('stroke-width', isSelected ? '3' : '1.5');
        circle.style.cursor = 'pointer';
        circle.dataset.itemId = item.id;
        
        // Буква
        if (item.type !== 'К' && item.type !== 'Щ') {
            const label = createSVGElement('text');
            label.setAttribute('x', ix);
            label.setAttribute('y', iy + 3.5);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', '#000');
            label.setAttribute('font-size', '8');
            label.setAttribute('font-weight', 'bold');
            label.textContent = item.type;
            circle.appendChild(label);
        }
        
        g.appendChild(circle);
    }
    
    function renderWires(svg, state, selectedItemId) {
        state.wires.forEach(wire => {
            const fromRoom = state.rooms.find(r => r.id === wire.fromRoomId);
            const toRoom = state.rooms.find(r => r.id === wire.toRoomId);
            if (!fromRoom || !toRoom) return;
            
            const fromItem = (fromRoom.items || []).find(i => i.id === wire.fromItemId);
            const toItem = (toRoom.items || []).find(i => i.id === wire.toItemId);
            if (!fromItem || !toItem) return;
            
            const x1 = (fromRoom.x0 + fromItem.x) * PX_PER_METER;
            const y1 = (fromRoom.y0 + fromItem.y) * PX_PER_METER;
            const x2 = (toRoom.x0 + toItem.x) * PX_PER_METER;
            const y2 = (toRoom.y0 + toItem.y) * PX_PER_METER;
            
            const sectionColors = {1.5: '#a78bfa', 2.5: '#22d3ee', 6: '#fb923c'};
            const section = wire.section || 2.5;
            
            const line = createSVGElement('line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', sectionColors[section] || '#fff');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '8,4');
            line.setAttribute('opacity', '0.7');
            
            svg.appendChild(line);
        });
    }
    
    function snapToWallPoint(x, y, W, L) {
        const dists = [
            {dist: Math.abs(y), wall: 'top', x, y: 0},
            {dist: Math.abs(W - x), wall: 'right', x: W, y},
            {dist: Math.abs(L - y), wall: 'bottom', x, y: L},
            {dist: Math.abs(x), wall: 'left', x: 0, y}
        ];
        return dists.reduce((min, curr) => curr.dist < min.dist ? curr : min);
    }
    
    function createSVGElement(type) {
        return document.createElementNS(SVG_NS, type);
    }
    
    return { render };
})();
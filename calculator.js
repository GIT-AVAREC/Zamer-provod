// calculator.js - Расчеты и смета
const Calculator = (function() {
    'use strict';
    
    const SECTIONS = {'Л': 1.5, 'В': 1.5, 'Р': 2.5, 'С': 2.5, 'П': 6};
    
    function calculate(state) {
        const {rooms, wires, settings, prices} = state;
        
        // Расчет длин кабелей
        let total15 = 0, total25 = 0, total6 = 0;
        const wireDetails = [];
        
        wires.forEach(wire => {
            const fromRoom = rooms.find(r => r.id === wire.fromRoomId);
            const toRoom = rooms.find(r => r.id === wire.toRoomId);
            if (!fromRoom || !toRoom) return;
            
            const fromItem = (fromRoom.items || []).find(i => i.id === wire.fromItemId);
            const toItem = (toRoom.items || []).find(i => i.id === wire.toItemId);
            if (!fromItem || !toItem) return;
            
            // Расстояние по прямой + вертикальные участки
            const fx = fromRoom.x0 + fromItem.x;
            const fy = fromRoom.y0 + fromItem.y;
            const tx = toRoom.x0 + toItem.x;
            const ty = toRoom.y0 + toItem.y;
            
            let length = Math.hypot(tx - fx, ty - fy);
            
            // Добавляем подъемы/спуски
            if (fromItem.type === 'В') length += (fromRoom.H - settings.switchh / 100);
            if (fromItem.type === 'Р') length += (fromRoom.H - settings.outlet / 100);
            if (fromItem.type === 'Щ') length += (fromRoom.H - settings.panel / 100);
            
            if (toItem.type === 'В') length += (toRoom.H - settings.switchh / 100);
            if (toItem.type === 'Р') length += (toRoom.H - settings.outlet / 100);
            if (toItem.type === 'Щ') length += (toRoom.H - settings.panel / 100);
            
            // Запас с концов
            length += (settings.reserve / 100) * 2;
            
            const section = SECTIONS[wire.type] || 2.5;
            
            if (section === 1.5) total15 += length;
            else if (section === 2.5) total25 += length;
            else if (section === 6) total6 += length;
            
            wireDetails.push({
                section,
                from: `${fromRoom.name}`,
                to: `${toRoom.name}`,
                type: wire.type,
                length
            });
        });
        
        // Закупочный запас
        const pct = 1 + (settings.pct || 0) / 100;
        total15 *= pct;
        total25 *= pct;
        total6 *= pct;
        
        // Подсчет элементов
        let korob = 0, podroz = 0, doors = 0, windows = 0;
        rooms.forEach(room => {
            (room.items || []).forEach(item => {
                if (item.type === 'К') korob++;
                if (item.type === 'Р' || item.type === 'В') podroz++;
                if (item.type === 'Д') doors++;
                if (item.type === 'О') windows++;
            });
        });
        
        // Обновление UI
        updateSummary(total15, total25, total6);
        updateWireTable(wireDetails);
        updateMaterialTable(total15, total25, total6, korob, podroz, prices);
        updateRoomTable(rooms);
    }
    
    function updateSummary(t15, t25, t6) {
        const total = t15 + t25 + t6;
        
        setText('ch15', formatLength(t15));
        setText('ch25', formatLength(t25));
        setText('ch6', formatLength(t6));
        setText('chT', formatLength(total));
    }
    
    function updateWireTable(details) {
        const tbody = document.getElementById('tb');
        if (!tbody) return;
        
        const sectionNames = {1.5: '3×1,5', 2.5: '3×2,5', 6: '3×6'};
        const typeNames = {
            'Л': 'Свет', 'В': 'Выключатель', 'Р': 'Розетка',
            'С': 'Кондиционер', 'П': 'Варочная', 'К': 'Коробка', 'Щ': 'Щиток'
        };
        
        tbody.innerHTML = details.map(w => `
            <tr>
                <td>${sectionNames[w.section] || w.section}</td>
                <td>${w.from} → ${w.to} (${typeNames[w.type] || w.type})</td>
                <td>${w.section} мм²</td>
                <td class="cmon">${formatLength(w.length)}</td>
            </tr>
        `).join('');
        
        // Итоги
        const sections = {};
        details.forEach(w => {
            sections[w.section] = (sections[w.section] || 0) + w.length;
        });
        
        const tfoot = document.getElementById('tf');
        if (tfoot) {
            tfoot.innerHTML = Object.entries(sections).map(([s, l]) => `
                <tr>
                    <td colspan="3">${sectionNames[s] || s}</td>
                    <td class="clen">${formatLength(l)}</td>
                </tr>
            `).join('') + `
                <tr>
                    <td colspan="3"><b>Всего</b></td>
                    <td class="clen"><b>${formatLength(Object.values(sections).reduce((a, b) => a + b, 0))}</b></td>
                </tr>
            `;
        }
    }
    
    function updateMaterialTable(t15, t25, t6, korob, podroz, prices) {
        const tm = document.getElementById('tm');
        if (!tm) return;
        
        const c15 = Math.ceil(t15);
        const c25 = Math.ceil(t25);
        const c6 = Math.ceil(t6);
        
        const cost15 = c15 * prices.cab[1.5];
        const cost25 = c25 * prices.cab[2.5];
        const cost6 = c6 * prices.cab[6];
        
        // Автоматы
        let brk = 0;
        if (t15 > 0) brk++;
        if (t25 > 0) brk++;
        if (t6 > 0) brk++;
        
        const rcd = Math.ceil(brk / 3);
        const costBrk = brk * prices.brk;
        const costRcd = rcd * prices.rcd;
        const costPanel = prices.panel;
        const costPodroz = podroz * prices.podroz;
        const costKorob = korob * prices.korob;
        
        const total = cost15 + cost25 + cost6 + costBrk + costRcd + costPanel + costPodroz + costKorob;
        
        tm.innerHTML = [
            c15 > 0 && row('Кабель 3×1,5', `${c15} м`, prices.cab[1.5], cost15),
            c25 > 0 && row('Кабель 3×2,5', `${c25} м`, prices.cab[2.5], cost25),
            c6 > 0 && row('Кабель 3×6', `${c6} м`, prices.cab[6], cost6),
            row('Автоматы линии', `${brk} шт`, prices.brk, costBrk),
            row('УЗО', `${rcd} шт`, prices.rcd, costRcd),
            row('Щит', '1 шт', prices.panel, costPanel),
            row('Подрозетники', `${podroz} шт`, prices.podroz, costPodroz),
            row('Коробки распред.', `${korob} шт`, prices.korob, costKorob)
        ].filter(Boolean).join('');
        
        const tmf = document.getElementById('tmf');
        if (tmf) {
            tmf.innerHTML = `<tr><td colspan="3"><b>Итого</b></td><td class="clen"><b>${money(total)}</b></td></tr>`;
        }
        
        setText('chM', money(total));
    }
    
    function updateRoomTable(rooms) {
        const trm = document.getElementById('trm');
        if (!trm) return;
        
        trm.innerHTML = rooms.map(room => {
            const items = room.items || [];
            const k = items.filter(i => i.type === 'К').length;
            const p = items.filter(i => i.type === 'Р' || i.type === 'В').length;
            const d = items.filter(i => i.type === 'Д').length;
            const o = items.filter(i => i.type === 'О').length;
            return `<tr>
                <td>${room.name}</td>
                <td class="cmon">${k}</td>
                <td class="cmon">${p}</td>
                <td class="cmon">—</td>
                <td class="cmon">—</td>
                <td class="cmon">${d}</td>
                <td class="cmon">${o}</td>
            </tr>`;
        }).join('');
    }
    
    function row(name, qty, price, sum) {
        return `<tr>
            <td>${name}</td>
            <td class="cmon">${qty}</td>
            <td class="cmon">${money(price)}</td>
            <td class="cmon">${money(sum)}</td>
        </tr>`;
    }
    
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
    
    function formatLength(l) {
        return Math.round(l * 100) / 100 + ' м';
    }
    
    function money(n) {
        return Math.round(n).toLocaleString('ru-RU') + ' ₽';
    }
    
    return { calculate };
})();
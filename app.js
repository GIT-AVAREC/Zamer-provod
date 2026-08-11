// app.js - Инициализация приложения
(function() {
    'use strict';
    
    // Инициализация модулей
    const core = Provodomer.init();
    const eventHandler = EventHandler.init(core, Renderer, Calculator);
    
    // Первичная отрисовка
    function initUI() {
        Renderer.render(core.getState(), core.getCamera());
        Calculator.calculate(core.getState());
        
        // Обновление списка комнат
        const state = core.getState();
        const ul = document.getElementById('roomList');
        if (ul) {
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
        }
        
        // Загрузка настроек в форму
        const s = state.settings;
        setValue('sReserve', s.reserve);
        setValue('sPct', s.pct);
        setValue('sOutlet', s.outlet);
        setValue('sSwitch', s.switchh);
        setValue('sCookH', s.cookH);
        setValue('sBoxOff', s.boxOff);
        setValue('sAcOff', s.acOff);
        setValue('sPanel', s.panel);
        
        // Загрузка цен
        const p = state.prices;
        setValue('pC15', p.cab[1.5]);
        setValue('pC25', p.cab[2.5]);
        setValue('pC4', p.cab[4]);
        setValue('pC6', p.cab[6]);
        setValue('pBrk', p.brk);
        setValue('pRcd', p.rcd);
        setValue('pPanelP', p.panel);
        setValue('pPodroz', p.podroz);
        setValue('pKorob', p.korob);
    }
    
    function setValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    
    initUI();
    
    console.log('✅ Проводомер v2.0 инициализирован');
    console.log('📐 Комнат:', core.getState().rooms.length);
    console.log('🔌 Элементов:', core.getState().rooms.reduce((sum, r) => sum + (r.items?.length || 0), 0));
    console.log('🔗 Проводов:', core.getState().wires.length);
})();
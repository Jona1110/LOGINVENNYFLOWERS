// Validación de Seguridad
// if (sessionStorage.getItem('vf_logged_in') !== 'true' || sessionStorage.getItem('vf_role') !== 'admin') {
   //  window.location.href = '../index.html';
// }

/* ==========================================================================
   Lógica del Panel de Administración - V2 (Scrap, Mayoreo & Vista Previa)
   ========================================================================== */

const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwy7qdPM56p_NT0VRM-f9QMGFD_9jxgCzOIzYcUKrFsOdDOd-ABwEGUjFvjpTRDHgCfSQ/exec";
const ADMIN_CACHE_KEY = "venny_flowers_admin_cache";

let datosGlobalesAdmin = {}; 
let fechaCalendarioActual = new Date(); 
let chartIngresosInstance = null;
let chartEstatusInstance = null;

// ==========================================================================
// 1. INICIALIZACIÓN Y EVENTOS GLOBALES
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    
    // Listeners de Formularios
    document.getElementById('form-venta').addEventListener('submit', registrarVentaMostrador);
    
    const formScrap = document.getElementById('form-scrap');
    if (formScrap) {
        formScrap.addEventListener('submit', registrarScrap);
    }
    
    const formNuevoProd = document.getElementById('form-nuevo-producto');
    if(formNuevoProd) {
        formNuevoProd.addEventListener('submit', registrarNuevoProducto);
    }
});

// ==========================================================================
// 2. UTILIDADES GENERALES
// ==========================================================================

// Funciones para el Modal de Vista Previa de Imagen
window.abrirImagen = function(e, url) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    if(!url || url.length < 10 || url.startsWith('#')) return; 
    const modal = document.getElementById('modal-imagen');
    const img = document.getElementById('img-ampliada');
    img.src = url;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); img.classList.remove('scale-95'); }, 10);
}

window.cerrarImagen = function() {
    const modal = document.getElementById('modal-imagen');
    const img = document.getElementById('img-ampliada');
    modal.classList.add('opacity-0'); img.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('notificaciones-container');
    const toast = document.createElement('div');
    
    let colorBorde = 'border-oro';
    let colorTexto = 'text-cafe';
    let titulo = 'Notificación';
    
    if (tipo === 'error') { 
        colorBorde = 'border-rose-500'; 
        colorTexto = 'text-rose-700'; 
        titulo = 'Error del Sistema'; 
    } else if (tipo === 'exito') { 
        colorBorde = 'border-emerald-500'; 
        colorTexto = 'text-emerald-700'; 
        titulo = '¡Operación Exitosa!'; 
    }

    toast.className = `bg-white border-l-4 ${colorBorde} shadow-2xl rounded-xl p-4 flex items-center space-x-3 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto w-80 sm:w-96 border border-stone-100`;
    
    toast.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-[#FAF6F0] border-2 border-[#E8DCC4] flex-shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
            <span class="text-xs font-bold font-playfair text-oro">VF</span>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-bold font-playfair ${colorTexto} truncate">${titulo}</p>
            <p class="text-xs text-stone-500 leading-snug mt-0.5 break-words">${mensaje}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-stone-300 hover:text-stone-600 transition flex-shrink-0 p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-x-full', 'opacity-0'); }, 10);
    setTimeout(() => { 
        toast.classList.add('translate-x-full', 'opacity-0'); 
        setTimeout(() => toast.remove(), 300); 
    }, 4500);
}

function formatearFechaSegura(fechaMala) {
    if (!fechaMala) return null;
    if (typeof fechaMala === 'string' && fechaMala.length === 10 && !fechaMala.includes('T')) {
        return new Date(fechaMala + 'T12:00:00');
    }
    const f = new Date(fechaMala);
    return isNaN(f.getTime()) ? null : f;
}

function cambiarTab(tabId) {
    document.querySelectorAll('.admin-seccion').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`seccion-${tabId}`).classList.remove('hidden');

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('text-oro', 'border-oro');
        tab.classList.add('text-stone-400', 'border-transparent');
    });
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    activeTab.classList.remove('text-stone-400', 'border-transparent');
    activeTab.classList.add('text-oro', 'border-oro');
    
    if(tabId === 'pedidos') renderizarCalendario();
}

function procesarImagenBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve("");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ==========================================================================
// 3. SINCRONIZACIÓN Y CARGA DE DATOS
// ==========================================================================
function inicializarAdmin() {
    const datosGuardados = localStorage.getItem(ADMIN_CACHE_KEY);
    if (datosGuardados) {
        try {
            datosGlobalesAdmin = JSON.parse(datosGuardados);
            renderizarTodo(datosGlobalesAdmin);
            
            document.getElementById('admin-loader').classList.add('hidden');
            document.getElementById('admin-content').classList.remove('hidden');
        } catch (e) { 
            console.error("Error leyendo caché admin:", e); 
        }
    } else {
        document.getElementById('admin-content').classList.add('hidden');
        document.getElementById('admin-loader').classList.remove('hidden');
    }
    
    cargarDatosAdmin();
}

async function cargarDatosAdmin(mostrarNotificacionExito = false) {
    try {
        const res = await fetch(`${URL_GOOGLE_SCRIPT}?accion=obtener_admin_data`);
        const json = await res.json();

        if (json.exito) {
            datosGlobalesAdmin = json.datos; 
            localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(datosGlobalesAdmin));
            
            renderizarTodo(datosGlobalesAdmin);
            
            document.getElementById('admin-loader').classList.add('hidden');
            document.getElementById('admin-content').classList.remove('hidden');
            
            if (mostrarNotificacionExito) mostrarNotificacion("Datos sincronizados con éxito", 'exito');
        } else {
            mostrarNotificacion("Error al sincronizar: " + json.mensaje, 'error');
        }
    } catch (error) {
        if (!localStorage.getItem(ADMIN_CACHE_KEY)) {
            mostrarNotificacion("Revisa tu conexión a internet.", "error");
        }
    }
}

function renderizarTodo(datos) {
    renderizarDashboard(datos);
    renderizarPedidos(datos.pedidos);
    renderizarCalendario(); 
    cambiarVistaInventario(); 
    renderizarFinanzas(datos.finanzas);
    renderizarScrap(datos.scrap);
}

// ==========================================================================
// 4. MÓDULO DE DASHBOARD
// ==========================================================================
function renderizarDashboard(datos) {
    const hoy = new Date();
    const hoyStrLocal = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

    let pedidosHoyCount = 0;
    let totalIngresos = 0;
    let scrapMes = 0;
    let agotadosCount = 0;
    
    // Calcular Pedidos de Hoy
    (datos.pedidos || []).forEach(p => {
        const f = formatearFechaSegura(p.Fecha_Registro);
        if (f) {
            const pStr = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
            if (pStr === hoyStrLocal) pedidosHoyCount++;
        }
    });

    // Calcular Ingresos de Hoy
    (datos.finanzas || []).forEach(f => {
        const d = formatearFechaSegura(f.Fecha);
        if (d) {
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (dStr === hoyStrLocal && f.Tipo === 'Ingreso') {
                totalIngresos += parseFloat(f.Monto) || 0;
            }
        }
    });
    
    // Calcular Insumos Agotados
    ['flores', 'bases', 'papeles', 'extras'].forEach(cat => {
        if (datos[cat]) {
            agotadosCount += datos[cat].filter(item => {
                const disp = item.Disponible ? String(item.Disponible).trim().toUpperCase() : "NO";
                return disp !== "SI";
            }).length;
        }
    });

    // Calcular Merma del Mes Actual
    (datos.scrap || []).forEach(s => {
        const d = formatearFechaSegura(s.Fecha);
        if (d && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()) {
            scrapMes += parseFloat(s.Costo_Perdida) || 0;
        }
    });

    // Actualizar Tarjetas
    document.getElementById('dash-pedidos').textContent = pedidosHoyCount;
    document.getElementById('dash-ingresos').textContent = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('dash-alertas').textContent = agotadosCount;
    document.getElementById('dash-scrap-perdida').textContent = `$${scrapMes.toFixed(2)}`;

    // Gráfica de Ingresos (Últimos 7 días)
    const ultimos7Dias = [];
    const ingresos7Dias = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        
        const label = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
        ultimos7Dias.push(label.charAt(0).toUpperCase() + label.slice(1)); 
        
        let sumaDia = 0;
        (datos.finanzas || []).forEach(f => {
            const fd = formatearFechaSegura(f.Fecha);
            if(fd) {
                const fdStr = `${fd.getFullYear()}-${String(fd.getMonth()+1).padStart(2,'0')}-${String(fd.getDate()).padStart(2,'0')}`;
                if(fdStr === dStr && f.Tipo === 'Ingreso') {
                    sumaDia += parseFloat(f.Monto) || 0;
                }
            }
        });
        ingresos7Dias.push(sumaDia);
    }

    if (chartIngresosInstance) chartIngresosInstance.destroy(); 
    const ctxIngresos = document.getElementById('graficaIngresos').getContext('2d');
    chartIngresosInstance = new Chart(ctxIngresos, {
        type: 'line',
        data: {
            labels: ultimos7Dias,
            datasets: [{
                label: 'Ingresos Totales ($)', 
                data: ingresos7Dias,
                borderColor: '#C5A059', 
                backgroundColor: 'rgba(197, 160, 89, 0.1)', 
                borderWidth: 2, 
                fill: true, 
                tension: 0.4, 
                pointBackgroundColor: '#C5A059', 
                pointRadius: 4
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } } } }
        }
    });

    // Gráfica de Estatus
    let countPendiente = 0, countProceso = 0, countCompletado = 0, countCancelado = 0;
    (datos.pedidos || []).forEach(p => {
        const estatus = p.Estado || 'Pendiente';
        if(estatus === 'Pendiente') countPendiente++;
        else if(estatus === 'En Proceso') countProceso++;
        else if(estatus === 'Completado') countCompletado++;
        else if(estatus === 'Cancelado') countCancelado++;
    });

    if (chartEstatusInstance) chartEstatusInstance.destroy();
    const ctxEstatus = document.getElementById('graficaEstatus').getContext('2d');
    chartEstatusInstance = new Chart(ctxEstatus, {
        type: 'doughnut',
        data: {
            labels: ['Pendientes', 'En Proceso', 'Completados', 'Cancelados'],
            datasets: [{
                data: [countPendiente, countProceso, countCompletado, countCancelado],
                backgroundColor: ['#E8DCC4', '#FCD34D', '#34D399', '#F87171'], 
                borderWidth: 0, 
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '75%', 
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Plus Jakarta Sans', sans-serif" } } 
                } 
            }
        }
    });
}

// ==========================================================================
// 5. MÓDULO DE PEDIDOS Y CALENDARIO
// ==========================================================================
function cambiarVistaPedidos(vista) {
    if(vista === 'lista') {
        document.getElementById('vista-lista-pedidos').classList.remove('hidden');
        document.getElementById('vista-calendario-pedidos').classList.add('hidden');
        
        document.getElementById('btn-vista-lista').className = 'px-4 py-1.5 text-sm font-semibold rounded-lg bg-white shadow-sm text-oro transition';
        document.getElementById('btn-vista-calendario').className = 'px-4 py-1.5 text-sm font-semibold rounded-lg text-stone-500 hover:text-cafe transition';
    } else {
        document.getElementById('vista-lista-pedidos').classList.add('hidden');
        document.getElementById('vista-calendario-pedidos').classList.remove('hidden');
        
        document.getElementById('btn-vista-calendario').className = 'px-4 py-1.5 text-sm font-semibold rounded-lg bg-white shadow-sm text-oro transition';
        document.getElementById('btn-vista-lista').className = 'px-4 py-1.5 text-sm font-semibold rounded-lg text-stone-500 hover:text-cafe transition';
        
        renderizarCalendario();
    }
}

function renderizarPedidos(pedidos) {
    const tbody = document.getElementById('tabla-pedidos-body');
    tbody.innerHTML = '';
    
    pedidos.slice().reverse().forEach(p => {
        const fechaRegObj = formatearFechaSegura(p.Fecha_Registro);
        const fechaRegistro = fechaRegObj ? fechaRegObj.toLocaleDateString('es-MX') : 'Desconocida';
        
        let fechaEntrega = "Por definir";
        const fechaEntObj = formatearFechaSegura(p.Fecha_Entrega);
        if(fechaEntObj) fechaEntrega = fechaEntObj.toLocaleDateString('es-MX');
        
        const estadoActual = p.Estado || 'Pendiente';
        
        const html = `
            <tr class="hover:bg-stone-50 transition">
                <td class="p-4">
                    <span class="font-bold text-oro">${p.ID_Pedido}</span><br>
                    <span class="text-xs text-stone-400">Creado: ${fechaRegistro}</span>
                </td>
                <td class="p-4 font-medium">${p.Cliente}<br><span class="text-xs text-stone-400">${p.Telefono}</span></td>
                <td class="p-4">
                    <span class="font-bold text-cafe">${fechaEntrega}</span><br>
                    <span class="text-xs text-stone-500">${p.Horario || ''}</span>
                </td>
                <td class="p-4 text-xs leading-relaxed max-w-xs">${p.Detalles_Ramo}<br>
                    <span class="font-bold text-emerald-600 mt-1 block">Total: $${parseFloat(p.Total).toFixed(2) || p.Total}</span>
                </td>
                <td class="p-4">
                    <select onchange="actualizarEstatusPedido('${p.ID_Pedido}', this.value)" class="bg-crema border border-[#E8DCC4] rounded-xl px-3 py-1.5 text-xs font-bold text-cafe focus:outline-none focus:border-oro shadow-xs">
                        <option value="Pendiente" ${estadoActual === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="En Proceso" ${estadoActual === 'En Proceso' ? 'selected' : ''}>En Proceso</option>
                        <option value="Completado" ${estadoActual === 'Completado' ? 'selected' : ''}>Completado</option>
                        <option value="Cancelado" ${estadoActual === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', html);
    });
}

function cambiarMesCalendario(offset) {
    fechaCalendarioActual.setMonth(fechaCalendarioActual.getMonth() + offset);
    renderizarCalendario();
}

function renderizarCalendario() {
    const year = fechaCalendarioActual.getFullYear();
    const month = fechaCalendarioActual.getMonth();
    const primerDia = new Date(year, month, 1).getDay();
    const diasEnMes = new Date(year, month + 1, 0).getDate();
    
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('calendario-mes-anio').textContent = `${meses[month]} ${year}`;
    
    const grid = document.getElementById('calendario-dias');
    grid.innerHTML = '';
    document.getElementById('calendario-detalles').classList.add('hidden');

    const entregasPorFecha = {};
    (datosGlobalesAdmin.pedidos || []).forEach(p => {
        const fechaObj = formatearFechaSegura(p.Fecha_Entrega);
        if(fechaObj) {
            const fechaStr = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth()+1).padStart(2,'0')}-${String(fechaObj.getDate()).padStart(2,'0')}`;
            if(!entregasPorFecha[fechaStr]) entregasPorFecha[fechaStr] = [];
            entregasPorFecha[fechaStr].push(p);
        }
    });

    for (let i = 0; i < primerDia; i++) {
        grid.insertAdjacentHTML('beforeend', `<div></div>`);
    }

    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

    for (let i = 1; i <= diasEnMes; i++) {
        const fechaStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const entregas = entregasPorFecha[fechaStr] || [];
        
        const esHoy = fechaStr === hoyStr;
        const tieneEntregas = entregas.length > 0;
        
        let bgClass = "bg-stone-50 border border-transparent hover:border-[#E8DCC4]";
        let textClass = "text-stone-700";
        let indicator = "";

        if(esHoy) {
            bgClass = "bg-oro border-oro text-white shadow-md";
            textClass = "text-white font-bold";
        } else if (tieneEntregas) {
            bgClass = "bg-rosa-suave border-rose-200 hover:bg-rose-100";
            textClass = "text-rose-900 font-bold";
            indicator = `<span class="inline-block px-1.5 py-0.5 bg-rose-500 text-white rounded-md text-[9px] font-bold mt-1 shadow-sm">${entregas.length}</span>`;
        }

        const html = `
            <div onclick="mostrarEntregasDia('${fechaStr}')" class="cursor-pointer rounded-xl p-1 sm:p-2 h-14 sm:h-20 flex flex-col items-center justify-center transition ${bgClass}">
                <span class="text-sm sm:text-base ${textClass}">${i}</span>
                ${indicator}
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', html);
    }
}

function mostrarEntregasDia(fechaStr) {
    const entregas = (datosGlobalesAdmin.pedidos || []).filter(p => {
        const fechaObj = formatearFechaSegura(p.Fecha_Entrega);
        if(!fechaObj) return false;
        const pStr = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth()+1).padStart(2,'0')}-${String(fechaObj.getDate()).padStart(2,'0')}`;
        return pStr === fechaStr;
    });

    const detalles = document.getElementById('calendario-detalles');
    const lista = document.getElementById('calendario-lista-entregas');
    
    const [y, m, d] = fechaStr.split('-');
    document.getElementById('calendario-fecha-seleccionada').textContent = `Entregas para el ${d}/${m}/${y}`;
    
    lista.innerHTML = '';
    
    if(entregas.length === 0) {
        lista.innerHTML = '<p class="text-sm text-stone-500 italic bg-stone-50 p-4 rounded-xl border border-[#E8DCC4] text-center">Agenda libre para este día.</p>';
    } else {
        entregas.forEach(p => {
            const isCompletado = p.Estado === 'Completado';
            const bgCard = isCompletado ? 'bg-emerald-50 opacity-70' : 'bg-white shadow-sm';
            
            lista.insertAdjacentHTML('beforeend', `
                <div class="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl border border-[#E8DCC4] ${bgCard}">
                    <div>
                        <div class="flex items-center space-x-2">
                            <p class="font-bold text-cafe text-base">${p.Cliente}</p>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isCompletado ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-100 text-rose-700'}">${p.Estado || 'Pendiente'}</span>
                        </div>
                        <p class="text-xs text-stone-600 font-semibold mt-1">🕒 ${p.Horario || 'Horario sin definir'} • 🚚 ${p.Tipo_Entrega || 'Por confirmar'}</p>
                        <p class="text-xs text-stone-500 mt-1.5 leading-relaxed bg-stone-50 p-2 rounded-md">${p.Detalles_Ramo}</p>
                    </div>
                    <div class="mt-3 sm:mt-0 sm:text-right flex flex-col justify-between h-full">
                        <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">${p.ID_Pedido}</p>
                        <p class="font-bold text-oro text-lg">$${parseFloat(p.Total).toFixed(2) || p.Total}</p>
                    </div>
                </div>
            `);
        });
    }
    
    detalles.classList.remove('hidden');
    detalles.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function actualizarEstatusPedido(idPedido, nuevoEstado) {
    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'actualizar_estatus_pedido', idPedido: idPedido, estado: nuevoEstado }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        mostrarNotificacion(`Pedido ${idPedido} actualizado a: ${nuevoEstado}`, "exito");
        
        const pedido = datosGlobalesAdmin.pedidos.find(p => p.ID_Pedido === idPedido);
        if(pedido) {
            pedido.Estado = nuevoEstado;
            localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(datosGlobalesAdmin));
            renderizarDashboard(datosGlobalesAdmin);
        }
        renderizarCalendario();
    } catch(e) { 
        mostrarNotificacion("Error al actualizar el estatus.", "error"); 
    }
}

// ==========================================================================
// 6. MÓDULO DE INVENTARIO (CON MAYOREO Y VISTA PREVIA)
// ==========================================================================
function togglePrecioDocenaModal() {
    const selector = document.getElementById('nuevo-prod-hoja').value;
    const caja = document.getElementById('caja-docena');
    if (selector === "Inventario_Flores") {
        caja.classList.remove('hidden');
    } else {
        caja.classList.add('hidden');
        document.getElementById('nuevo-prod-docena').value = "";
    }
}

function cambiarVistaInventario() {
    const hojaSeleccionada = document.getElementById('selector-hoja-inv').value;
    const tbody = document.getElementById('tabla-inventario-body');
    const colDocena = document.getElementById('col-precio-docena');
    
    tbody.innerHTML = '';

    let listaItems = [];
    if (hojaSeleccionada === 'Inventario_Flores') {
        listaItems = datosGlobalesAdmin.flores || [];
        colDocena.classList.remove('hidden');
    } else if (hojaSeleccionada === 'Inventario_Bases') {
        listaItems = datosGlobalesAdmin.bases || [];
        colDocena.classList.add('hidden');
    } else if (hojaSeleccionada === 'Inventario_Papeles') {
        listaItems = datosGlobalesAdmin.papeles || [];
        colDocena.classList.add('hidden');
    } else if (hojaSeleccionada === 'Inventario_Extras') {
        listaItems = datosGlobalesAdmin.extras || [];
        colDocena.classList.add('hidden');
    }

    listaItems.forEach(item => {
        const isFlores = hojaSeleccionada === 'Inventario_Flores';
        const id = item.ID || 'SIN_ID';
        const nombre = item.Nombre || 'Sin Nombre';
        const precio = item.Precio_Unitario !== undefined ? item.Precio_Unitario : (item.Precio || 0);
        const precioDocena = item.Precio_Docena || 0;
        const isChecked = String(item.Disponible).trim().toUpperCase() === "SI" ? "checked" : "";
        
        const rawImagen = item.Imagen_URL || item.Color_Hex || "";
        let imgThumb = `<div class="w-12 h-12 rounded-lg border-2 border-dashed border-[#E8DCC4] flex items-center justify-center text-[10px] text-stone-400 font-bold bg-stone-50">S/F</div>`;
        
        if (rawImagen.startsWith('data:image') || rawImagen.startsWith('http')) {
            // Añado la función onclick para abrir la imagen
            imgThumb = `<div class="w-12 h-12 rounded-lg border-2 border-oro bg-cover bg-center shadow-sm cursor-pointer hover:opacity-80 transition" style="background-image: url('${rawImagen}')" onclick="abrirImagen(event, '${rawImagen}')"></div>`;
        } else if (rawImagen.startsWith('#')) {
            imgThumb = `<div class="w-12 h-12 rounded-lg border-2 border-[#E8DCC4] shadow-sm" style="background-color: ${rawImagen}"></div>`;
        }

        const htmlDocena = isFlores 
            ? `<td class="p-4"><input type="number" step="0.5" id="docena-${id}" value="${precioDocena}" class="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-emerald-800 w-20 focus:outline-none focus:border-emerald-500 transition"></td>` 
            : `<td class="hidden"></td>`;

        const html = `
            <tr class="hover:bg-stone-50 transition" id="row-${id}">
                <td class="p-4">${imgThumb}</td>
                <td class="p-4">
                    <span class="font-bold text-oro text-[10px] block mb-1">${id}</span>
                    <input type="text" id="nombre-${id}" value="${nombre}" class="bg-crema border border-[#E8DCC4] rounded-lg px-3 py-1.5 text-sm text-cafe w-full focus:outline-none focus:border-oro">
                </td>
                <td class="p-4">
                    <input type="number" step="0.5" id="precio-${id}" value="${precio}" class="bg-crema border border-[#E8DCC4] rounded-lg px-3 py-1.5 text-sm text-cafe w-20 focus:outline-none focus:border-oro">
                </td>
                ${htmlDocena}
                <td class="p-4">
                    <input type="file" id="img-${id}" accept="image/*" class="w-32 text-[10px] text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-stone-200 file:text-cafe hover:file:bg-stone-300 transition cursor-pointer">
                </td>
                <td class="p-4 text-center">
                    <input type="checkbox" id="disp-${id}" ${isChecked} class="w-5 h-5 accent-[#C5A059] cursor-pointer">
                </td>
                <td class="p-4 text-center space-x-2 whitespace-nowrap">
                    <button onclick="guardarCambiosProducto('${id}', '${hojaSeleccionada}')" class="bg-oro text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#b58f4a] shadow-xs transition">Guardar</button>
                    <button onclick="eliminarProducto('${id}', '${hojaSeleccionada}')" class="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-200 transition">X</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', html);
    });
    
    togglePrecioDocenaModal();
}

async function guardarCambiosProducto(id, hoja) {
    const nuevoNombre = document.getElementById(`nombre-${id}`).value;
    const nuevoPrecio = document.getElementById(`precio-${id}`).value;
    const nuevaDisponibilidad = document.getElementById(`disp-${id}`).checked ? "SI" : "NO";
    
    const docenaInput = document.getElementById(`docena-${id}`);
    const precioDocena = docenaInput ? docenaInput.value : 0;
    
    const inputImagen = document.getElementById(`img-${id}`);
    let imagenBase64 = "";
    if (inputImagen.files && inputImagen.files[0]) {
        imagenBase64 = await procesarImagenBase64(inputImagen.files[0]);
    }

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ 
                accion: 'actualizar_producto', 
                id: id, 
                nombre: nuevoNombre, 
                precio: nuevoPrecio, 
                estado: nuevaDisponibilidad, 
                hoja: hoja, 
                imagen: imagenBase64,
                precio_docena: precioDocena
            }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        mostrarNotificacion(`Producto ${id} actualizado.`, "exito");
        cargarDatosAdmin(); 
    } catch(e) { 
        mostrarNotificacion("Error al guardar producto.", "error"); 
    }
}

async function registrarNuevoProducto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-prod');
    btn.innerHTML = "Procesando..."; 
    btn.disabled = true;

    const inputImagen = document.getElementById('nuevo-prod-imagen');
    let imagenBase64 = "";
    if (inputImagen.files && inputImagen.files[0]) {
        imagenBase64 = await procesarImagenBase64(inputImagen.files[0]);
    }

    const nuevoItem = {
        hoja: document.getElementById('nuevo-prod-hoja').value,
        nombre: document.getElementById('nuevo-prod-nombre').value,
        precio: document.getElementById('nuevo-prod-precio').value,
        precio_docena: document.getElementById('nuevo-prod-docena').value || 0,
        disponible: document.getElementById('nuevo-prod-disp').value,
        imagen: imagenBase64
    };

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'crear_producto', producto: nuevoItem }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        cerrarModalProducto();
        mostrarNotificacion("Producto creado con éxito.", "exito");
        cargarDatosAdmin(); 
    } catch(err) { 
        mostrarNotificacion("Error al crear producto.", "error"); 
    } finally { 
        btn.innerHTML = "Crear Producto"; 
        btn.disabled = false; 
    }
}

function abrirModalProducto() {
    const modal = document.getElementById('modal-producto');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.getElementById('modal-producto-content').classList.remove('scale-95');
}

function cerrarModalProducto() {
    const modal = document.getElementById('modal-producto');
    modal.classList.add('opacity-0');
    document.getElementById('modal-producto-content').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('form-nuevo-producto').reset();
}

async function eliminarProducto(id, hoja) {
    if(!confirm(`¿Seguro de eliminar el ID: ${id}?`)) return;
    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'eliminar_producto', id: id, hoja: hoja }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        mostrarNotificacion("Producto eliminado.", "exito");
        cargarDatosAdmin();
    } catch(err) { 
        mostrarNotificacion("Error al eliminar.", "error"); 
    }
}

// ==========================================================================
// 7. MÓDULO DE FINANZAS
// ==========================================================================
function renderizarFinanzas(movimientos) {
    const tbody = document.getElementById('tabla-finanzas-body');
    tbody.innerHTML = '';
    
    (movimientos || []).slice().reverse().forEach(m => {
        const fechaObj = formatearFechaSegura(m.Fecha);
        const fecha = fechaObj ? fechaObj.toLocaleDateString('es-MX', { hour: '2-digit', minute:'2-digit' }) : 'Sin fecha';
        
        const html = `
            <tr class="hover:bg-stone-50 transition">
                <td class="p-4 text-xs text-stone-500">${fecha}</td>
                <td class="p-4 font-medium text-cafe">${m.Concepto}</td>
                <td class="p-4 text-xs"><span class="bg-stone-200 px-2 py-1 rounded">${m.Metodo}</span></td>
                <td class="p-4 font-bold text-right text-emerald-600">+$${parseFloat(m.Monto).toFixed(2)}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', html);
    });
}

function abrirModalVenta() {
    const modal = document.getElementById('modal-venta');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.getElementById('modal-content').classList.remove('scale-95');
}

function cerrarModalVenta() {
    const modal = document.getElementById('modal-venta');
    modal.classList.add('opacity-0');
    document.getElementById('modal-content').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('form-venta').reset();
}

async function registrarVentaMostrador(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-venta');
    btn.innerHTML = "Guardando..."; 
    btn.disabled = true;

    const venta = {
        concepto: document.getElementById('venta-concepto').value,
        monto: document.getElementById('venta-monto').value,
        metodo: document.getElementById('venta-metodo').value
    };

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'guardar_venta_mostrador', venta: venta }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        cerrarModalVenta();
        mostrarNotificacion("Venta registrada.", "exito");
        cargarDatosAdmin(); 
    } catch (error) { 
        mostrarNotificacion("Error al guardar venta.", "error"); 
    } finally { 
        btn.innerHTML = "Guardar Venta"; 
        btn.disabled = false; 
    }
}

// ==========================================================================
// 8. MÓDULO DE SCRAP (MERMA)
// ==========================================================================
function renderizarScrap(scrap) {
    const tbody = document.getElementById('tabla-scrap-body');
    tbody.innerHTML = '';
    
    (scrap || []).slice().reverse().forEach(s => {
        const fechaObj = formatearFechaSegura(s.Fecha);
        const fecha = fechaObj ? fechaObj.toLocaleDateString('es-MX') : 'Sin fecha';
        
        const html = `
            <tr class="hover:bg-rose-50 transition">
                <td class="p-4 text-xs text-stone-500">${fecha}</td>
                <td class="p-4 font-medium text-rose-900">${s.Producto}</td>
                <td class="p-4 text-center font-bold text-rose-700">${s.Cantidad}</td>
                <td class="p-4 text-xs text-stone-600">${s.Motivo}</td>
                <td class="p-4 font-bold text-right text-rose-600">-$${parseFloat(s.Costo_Perdida).toFixed(2)}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', html);
    });
}

function abrirModalScrap() {
    const modal = document.getElementById('modal-scrap');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.getElementById('modal-scrap-content').classList.remove('scale-95');
}

function cerrarModalScrap() {
    const modal = document.getElementById('modal-scrap');
    modal.classList.add('opacity-0');
    document.getElementById('modal-scrap-content').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('form-scrap').reset();
}

async function registrarScrap(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-scrap');
    btn.innerHTML = "Guardando..."; 
    btn.disabled = true;

    const scrapData = {
        producto: document.getElementById('scrap-producto').value,
        cantidad: document.getElementById('scrap-cantidad').value,
        motivo: document.getElementById('scrap-motivo').value,
        perdida: document.getElementById('scrap-perdida').value
    };

    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'guardar_scrap', scrap: scrapData }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        cerrarModalScrap();
        mostrarNotificacion("Merma registrada.", "exito");
        cargarDatosAdmin(); 
    } catch (error) { 
        mostrarNotificacion("Error al registrar merma.", "error"); 
    } finally { 
        btn.innerHTML = "Guardar Registro"; 
        btn.disabled = false; 
    }
}

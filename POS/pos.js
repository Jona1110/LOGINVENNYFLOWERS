/* ==========================================================================
   Lógica del Punto de Venta (Caja y Catálogo) - Venny Flowers
   ========================================================================== */

const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwy7qdPM56p_NT0VRM-f9QMGFD_9jxgCzOIzYcUKrFsOdDOd-ABwEGUjFvjpTRDHgCfSQ/exec";
const POS_CACHE_KEY = "venny_flowers_pos_cache";

let datosGlobalesPOS = {}; 

document.addEventListener('DOMContentLoaded', () => {
    inicializarPOS();
    
    // Listeners
    document.getElementById('form-venta-pos').addEventListener('submit', registrarVentaMostrador);
    
    const formNuevoProd = document.getElementById('form-nuevo-producto');
    if(formNuevoProd) {
        formNuevoProd.addEventListener('submit', registrarNuevoProducto);
    }
});

// ==========================================================================
// 1. SISTEMA DE NOTIFICACIONES Y UTILIDADES
// ==========================================================================
function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('notificaciones-container');
    const toast = document.createElement('div');
    
    let colorBorde = 'border-oro';
    let colorTexto = 'text-cafe';
    let titulo = 'Notificación';
    
    if (tipo === 'error') { 
        colorBorde = 'border-rose-500'; colorTexto = 'text-rose-700'; titulo = 'Error del Sistema'; 
    } else if (tipo === 'exito') { 
        colorBorde = 'border-emerald-500'; colorTexto = 'text-emerald-700'; titulo = '¡Operación Exitosa!'; 
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
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 4500);
}

function cambiarTab(tabId) {
    document.querySelectorAll('.pos-seccion').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`seccion-${tabId}`).classList.remove('hidden');

    document.querySelectorAll('.pos-tab').forEach(tab => {
        tab.classList.remove('text-oro', 'border-oro');
        tab.classList.add('text-stone-400', 'border-transparent');
    });
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    activeTab.classList.remove('text-stone-400', 'border-transparent');
    activeTab.classList.add('text-oro', 'border-oro');
}

function formatearFechaSegura(fechaMala) {
    if (!fechaMala) return null;
    if (typeof fechaMala === 'string' && fechaMala.length === 10 && !fechaMala.includes('T')) {
        return new Date(fechaMala + 'T12:00:00');
    }
    const f = new Date(fechaMala);
    return isNaN(f.getTime()) ? null : f;
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
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ==========================================================================
// 2. SINCRONIZACIÓN Y CARGA DE DATOS
// ==========================================================================
function inicializarPOS() {
    const datosGuardados = localStorage.getItem(POS_CACHE_KEY);
    if (datosGuardados) {
        try {
            datosGlobalesPOS = JSON.parse(datosGuardados);
            renderizarTodoPOS(datosGlobalesPOS);
            document.getElementById('pos-loader').classList.add('hidden');
            document.getElementById('pos-content').classList.remove('hidden');
        } catch (e) { console.error("Error leyendo caché POS:", e); }
    } else {
        document.getElementById('pos-content').classList.add('hidden');
        document.getElementById('pos-loader').classList.remove('hidden');
    }
    cargarDatosPOS();
}

async function cargarDatosPOS(mostrarNotificacionExito = false) {
    try {
        // Reusamos el endpoint de admin porque trae inventario y finanzas
        const res = await fetch(`${URL_GOOGLE_SCRIPT}?accion=obtener_admin_data`);
        const json = await res.json();

        if (json.exito) {
            datosGlobalesPOS = json.datos; 
            localStorage.setItem(POS_CACHE_KEY, JSON.stringify(datosGlobalesPOS));
            
            renderizarTodoPOS(datosGlobalesPOS);
            document.getElementById('pos-loader').classList.add('hidden');
            document.getElementById('pos-content').classList.remove('hidden');
            
            if (mostrarNotificacionExito) mostrarNotificacion("Catálogo actualizado con éxito", 'exito');
        } else {
            mostrarNotificacion("Error al sincronizar: " + json.mensaje, 'error');
        }
    } catch (error) {
        if (!localStorage.getItem(POS_CACHE_KEY)) {
            mostrarNotificacion("Revisa tu conexión a internet.", "error");
        }
    }
}

function renderizarTodoPOS(datos) {
    cambiarVistaInventario(); 
    renderizarVentasHoy(datos.finanzas);
}

// ==========================================================================
// 3. CAJA REGISTRADORA (Ventas en Mostrador)
// ==========================================================================
function renderizarVentasHoy(movimientos) {
    const contenedor = document.getElementById('lista-ventas-hoy');
    contenedor.innerHTML = '';
    
    const hoyStrLocal = new Date().toLocaleDateString('es-MX');
    let ventasHoy = [];

    (movimientos || []).slice().reverse().forEach(m => {
        const fechaObj = formatearFechaSegura(m.Fecha);
        if(fechaObj && fechaObj.toLocaleDateString('es-MX') === hoyStrLocal && m.Tipo === 'Ingreso') {
            ventasHoy.push(m);
        }
    });

    if (ventasHoy.length === 0) {
        contenedor.innerHTML = '<p class="text-sm text-stone-400 italic text-center mt-10">Aún no hay ventas registradas el día de hoy.</p>';
        return;
    }

    ventasHoy.forEach(m => {
        const fechaObj = formatearFechaSegura(m.Fecha);
        const hora = fechaObj ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute:'2-digit' }) : '';
        
        const html = `
            <div class="flex justify-between items-center py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 px-2 rounded-lg transition">
                <div>
                    <p class="text-sm font-bold text-cafe">${m.Concepto}</p>
                    <p class="text-[10px] text-stone-500 uppercase tracking-wider">${hora} • <span class="bg-stone-200 px-1 rounded">${m.Metodo}</span></p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-emerald-600">+$${parseFloat(m.Monto).toFixed(2)}</p>
                </div>
            </div>
        `;
        contenedor.insertAdjacentHTML('beforeend', html);
    });
}

async function registrarVentaMostrador(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-venta');
    btn.innerHTML = "Procesando cobro..."; 
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
        
        document.getElementById('form-venta-pos').reset();
        mostrarNotificacion("Venta registrada con éxito.", "exito");
        cargarDatosPOS(); // Recarga para actualizar historial de ventas del día
    } catch (error) { 
        mostrarNotificacion("Error al registrar la venta. Intenta de nuevo.", "error"); 
    } finally { 
        btn.innerHTML = "Confirmar y Cobrar"; 
        btn.disabled = false; 
    }
}

// ==========================================================================
// 4. GESTIÓN DE CATÁLOGO (Inventario POS)
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
        listaItems = datosGlobalesPOS.flores || [];
        colDocena.classList.remove('hidden');
    } else if (hojaSeleccionada === 'Inventario_Bases') {
        listaItems = datosGlobalesPOS.bases || [];
        colDocena.classList.add('hidden');
    } else if (hojaSeleccionada === 'Inventario_Papeles') {
        listaItems = datosGlobalesPOS.papeles || [];
        colDocena.classList.add('hidden');
    } else if (hojaSeleccionada === 'Inventario_Extras') {
        listaItems = datosGlobalesPOS.extras || [];
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
            imgThumb = `<div class="w-12 h-12 rounded-lg border-2 border-oro bg-cover bg-center shadow-sm" style="background-image: url('${rawImagen}')"></div>`;
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
        cargarDatosPOS(); 
    } catch(e) { 
        mostrarNotificacion("Error al guardar producto.", "error"); 
    }
}

async function registrarNuevoProducto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-prod');
    btn.innerHTML = "Subiendo..."; 
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
        mostrarNotificacion("Insumo agregado con éxito.", "exito");
        cargarDatosPOS(); 
    } catch(err) { 
        mostrarNotificacion("Error al crear el producto.", "error"); 
    } finally { 
        btn.innerHTML = "Guardar en Sistema"; 
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
    if(!confirm(`¿Seguro de eliminar definitivamente el ID: ${id}?`)) return;
    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ accion: 'eliminar_producto', id: id, hoja: hoja }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        mostrarNotificacion("Insumo borrado del sistema.", "exito");
        cargarDatosPOS();
    } catch(err) { 
        mostrarNotificacion("Error al eliminar.", "error"); 
    }
}
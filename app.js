/* app.js final: +Foto Guardia +Comentarios +Opcion Notificar +Historial Cards +COMPRESION + TOAST + RESPALDO + ZXING / BarcodeDetector + QR (Modo "Scan-All") + FIX LOGIN HASH + FIX BUGS + PWA + FIX SHARE ANDROID v7 (Quitar Title) + FIX DOMICILIO EXACTO + FIX JPDF + FIX NOTIFICACION DUPLICADA */
(async function(){
  
  // --- INICIO REGISTRO PWA SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registrado con éxito, scope:', registration.scope);
        })
        .catch(err => {
          console.error('Fallo en el registro de ServiceWorker:', err);
        });
    });
  }
  // --- FIN REGISTRO PWA ---

  // --- INICIO SETUP DE jspdf ---
  let jsPDF;
  // ★★★ CORRECCIÓN AQUÍ: Acceso más robusto a la clase jsPDF del CDN umd ★★★
  if(window.jspdf && window.jspdf.jsPDF) {
    jsPDF = window.jspdf.jsPDF;
  } else if (typeof window.jsPDF === 'function') {
    jsPDF = window.jsPDF;
  }
  // --- FIN SETUP ---

  await openDB();

  // --- NUEVA FUNCIÓN: Generador de Banner de Notificación ---
  async function createBannerImage(text) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const width = 600;
      const height = 120;
      const ratio = 1; 
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.scale(ratio, ratio);
      
      // Fondo (Verde de éxito de la app)
      ctx.fillStyle = '#28a745';
      ctx.fillRect(0, 0, width, height);
      
      // Texto
      ctx.fillStyle = '#FFFFFF'; // Texto blanco
      ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText(text, width / 2, height / 2);
      
      // Exportar como PNG
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    });
  }

  async function hashText(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data); 
    const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex;
  }
  
  async function fileToDataURL(file){
    if(!file) return null;
    return new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function compressImage(file, quality = 0.7, maxWidth = 1280) {
    if (!file) return null;
    const imageBitmap = await createImageBitmap(file);
    const { width, height } = imageBitmap;
    let newWidth, newHeight;
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      newWidth = maxWidth;
      newHeight = height * ratio;
    } else {
      newWidth = width;
      newHeight = height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
    return new Promise((resolve) => {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    });
  }


  // LOGIN page
  if(document.body.classList.contains('page-login')){
     
    const loggedInUser = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(loggedInUser){ location.href = 'main.html'; return; }
    const container = document.querySelector('main.container'); 
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');     
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (showRegister && showLogin && container) {
      showRegister.onclick = () => { container.classList.add('active'); };
      showLogin.onclick = () => { container.classList.remove('active'); };
    }
    const openPrivacyLink = document.getElementById('openPrivacyLink');
    const privacyModal = document.getElementById('privacyModal');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');
    if (openPrivacyLink && privacyModal && closePrivacyBtn) {
      openPrivacyLink.onclick = (e) => { e.preventDefault(); privacyModal.classList.remove('hidden'); };
      closePrivacyBtn.onclick = () => { privacyModal.classList.add('hidden'); };
      privacyModal.addEventListener('click', (e) => { if (e.target === privacyModal) { privacyModal.classList.add('hidden'); } });
    }
    const regFotoInput = document.getElementById('regFoto');
    const regFotoBtn = document.getElementById('regFotoBtn');
    const regFotoPreview = document.getElementById('regFotoPreview');
    regFotoBtn.addEventListener('click', () => { regFotoInput.click(); });
    regFotoInput.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if(!f) { regFotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f); 
      regFotoPreview.innerHTML = `<img alt="foto perfil" src="${url}">`;
    });
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fotoFile = regFotoInput.files[0];
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      const codigo = document.getElementById('regCodigo').value.trim();
      if (!fotoFile) { alert('Es obligatorio tomar una foto de perfil para el registro.'); return; }
      if(pass !== pass2){ alert('Las contraseñas no coinciden'); return; } 
      const usuario = nombre.split(' ')[0].toLowerCase();
      const hashed = await hashText(pass);
      const fotoDataURL = await compressImage(fotoFile); 
      const ADMIN_CODE = "ADMIN123";
      const userRol = (codigo === ADMIN_CODE) ? 'admin' : 'guardia';
      try{
        const id = await addItem('users', { usuario, nombre, password: hashed, rol: userRol, foto: fotoDataURL, created: Date.now() });
        localStorage.setItem('ctrl_user', JSON.stringify({ id, usuario, nombre, rol: userRol, fotoGuardia: fotoDataURL }));
        location.href = 'main.html';
      }catch(err){ alert('Error: probablemente el usuario ya existe.'); console.error(err); }
    });
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const pass = document.getElementById('loginPass').value;
      const hashed = await hashText(pass);
      const users = await getAll('users');
      const user = users.find(u=>u.usuario===usuario || u.nombre===usuario);
      if(!user){ alert('Usuario no encontrado. Regístrate'); return; }
      if(user.password !== hashed){ alert('Contraseña incorrecta'); return; }
      const userRol = user.rol || 'guardia';
      const fotoGuardia = user.foto || null;
      localStorage.setItem('ctrl_user', JSON.stringify({ id:user.id, usuario:user.usuario, nombre:user.nombre, rol: userRol, fotoGuardia: fotoGuardia }));
      location.href = 'main.html';
    });
    const existing = await getAll('users');
    if(existing.length===0){
      const demoHash = await hashText('guard123');
      try{ await addItem('users',{usuario:'guardia',nombre:'Guardia Demo',password:demoHash,rol:'guardia', foto: null, created:Date.now()}); }catch(e){}
    }
  }

  // MAIN SPA
  if(document.body.classList.contains('page-main')){
    
    // ★★★ CORRECCIÓN: Se movió la verificación de jsPDF para que solo deshabilite el botón. ★★★
    if (!jsPDF) {
      console.warn("jsPDF no se cargó correctamente. El botón de PDF estará deshabilitado.");
      const pdfBtn = document.getElementById('downloadPdfBtn');
      if(pdfBtn) pdfBtn.disabled = true;
    }
    
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(!user){ location.href='index.html'; return; }
    
    const userRol = user.rol || 'guardia';
    const userFoto = user.fotoGuardia || null; 

    document.getElementById('saludo').textContent = `Buen turno ${user.nombre}`;
    document.getElementById('logoutBtn').onclick = ()=>{ localStorage.removeItem('ctrl_user'); location.href='index.html'; };

    const navBtnAdmin = document.getElementById('nav-btn-admin');
    if (userRol === 'admin') {
      navBtnAdmin.classList.remove('hidden');
    }

    const mainContainer = document.getElementById('app-main-container'); 
    const navBtns = document.querySelectorAll('.nav-btn');
    
    async function showScreen(id){ 
      mainContainer.classList.remove('show-paqueteria', 'show-directorio', 'show-historial', 'show-admin');
      if (id === 'screen-paqueteria') { mainContainer.classList.add('show-paqueteria'); } 
      else if (id === 'screen-directorio') { mainContainer.classList.add('show-directorio'); await refreshDomicilios(); } 
      else if (id === 'screen-historial') { mainContainer.classList.add('show-historial'); await refreshPaquetes(); } 
      else if (id === 'screen-admin') { if (userRol !== 'admin') return; mainContainer.classList.add('show-admin'); await refreshUsuarios(); }
      navBtns.forEach(b=>b.classList.remove('active'));
      document.querySelector(`.nav-btn[data-screen="${id}"]`).classList.add('active');
    }
    
    navBtns.forEach(btn=>btn.addEventListener('click', async () => await showScreen(btn.dataset.screen)));

    // --- Definición de Elementos ---
    const guiaEl = document.getElementById('guia');
    const guiaSuggestions = document.getElementById('guiaSuggestions');
    const nombreDest = document.getElementById('nombreDest');
    const nombresList = document.getElementById('nombresList');
    const paqueteriaInput = document.getElementById('paqueteriaInput');
    const paqList = document.getElementById('paqList');
    const domicilioInput = document.getElementById('domicilioInput');
    const domList = document.getElementById('domList');
    const fotoInput = document.getElementById('fotoInput');
    const fotoPreview = document.getElementById('fotoPreview');
    const recibirBtn = document.getElementById('recibirBtn');
    const entregarBtn = document.getElementById('entregarBtn');
    const comentariosPaquete = document.getElementById('comentariosPaquete');
    const notificarSi = document.getElementById('notificarSi');
    const fotoBtn = document.getElementById('fotoBtn');
    const idFotoBtn = document.getElementById('idFotoBtn');
    const historialPaquetes = document.getElementById('historialPaquetes'); 
    const tablaDomicilios = document.getElementById('tablaDomicilios');
    const domForm = document.getElementById('domForm');
    const addResident = document.getElementById('addResident');
    const moreResidents = document.getElementById('moreResidents');
    const buscarHist = document.getElementById('buscarHist');
    const filtroEstado = document.getElementById('filtroEstado');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const fechaDesdeLabel = document.getElementById('fechaDesdeLabel');
    const fechaHastaLabel = document.getElementById('fechaHastaLabel');
    const historialContador = document.getElementById('historialContador'); 
    const firmaModal = document.getElementById('firmaModal');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const limpiarFirma = document.getElementById('limpiarFirma');
    const guardarFirma = document.getElementById('guardarFirma');
    const cerrarFirma = document.getElementById('cerrarFirma');
    const idFotoInput = document.getElementById('idFotoInput');
    const idPreview = document.getElementById('idPreview');
    const notificarEntregaSi = document.getElementById('notificarEntregaSi');
    const confirmEntregarModal = document.getElementById('confirmEntregarModal');
    const confirmEntregarMsg = document.getElementById('confirmEntregarMsg');
    const cancelEntregarBtn = document.getElementById('cancelEntregarBtn');
    const confirmEntregarBtn = document.getElementById('confirmEntregarBtn');
    const entregarVariosBtn = document.getElementById('entregarVariosBtn');
    const confirmEntregarVariosModal = document.getElementById('confirmEntregarVariosModal');
    const domicilioVariosTxt = document.getElementById('domicilioVariosTxt');
    const listaPaquetesVarios = document.getElementById('listaPaquetesVarios');
    const cancelVariosBtn = document.getElementById('cancelVariosBtn');
    const confirmVariosBtn = document.getElementById('confirmVariosBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteConfirmMsg = document.getElementById('deleteConfirmMsg');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const tablaUsuarios = document.getElementById('tablaUsuarios');
    const imageViewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImg');
    const viewerMeta = document.getElementById('viewerMeta');
    const prevImg = document.getElementById('prevImg');
    const nextImg = document.getElementById('nextImg');
    const closeImageViewer = document.getElementById('closeImageViewer');
    
    // --- NUEVOS ELEMENTOS: Respaldo ---
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    const restoreBackupInput = document.getElementById('restoreBackupInput');

    // --- NUEVOS ELEMENTOS: Escáner (ZXing / BarcodeDetector) ---
    const startScannerBtn = document.getElementById('startScannerBtn');
    const stopScannerBtn = document.getElementById('stopScannerBtn');
    const scannerModal = document.getElementById('scannerModal');
    const scannerVideo = document.getElementById('scanner-video');
    const scannerStatus = document.getElementById('scannerStatus');

    let itemToDelete = { type: null, id: null }; 
    let currentBatchToDeliver = []; 
    let domicilioDebounceTimer; 
    
    // --- SISTEMA DE NOTIFICACIÓN TOAST (con corrección de animación) ---
    let toastTimer;
    const toast = document.getElementById('toastNotification');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    const ICONS = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-2 15l-5-5l1.41-1.41L10 16.17l7.59-7.59L19 10z"/></svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>`,
      loading: `<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-dasharray="15" stroke-dashoffset="15" stroke-linecap="round" stroke-width="2" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>`
    };
    function showToast(message, type = 'success', duration = 3000) {
      if (!toast || !toastIcon || !toastMessage) return; 
      clearTimeout(toastTimer);
      toastMessage.textContent = message;
      toastIcon.innerHTML = ICONS[type] || ICONS['info'];
      toast.className = 'toast-container';
      toast.classList.add(type);
      toast.classList.add('show');
      // ★★★ CAMBIO: Quitar clase 'hiding' y animación de salida forzada para evitar el 'cuadro negro' ★★★
      toast.classList.remove('hiding'); 
      if (type !== 'loading' && duration > 0) {
        // Usar una función que solo quite la clase 'show'
        toastTimer = setTimeout(() => { 
          toast.classList.remove('show');
          // Limpiar clases después de la transición de CSS (500ms)
          setTimeout(() => {
            toast.classList.remove('success', 'error', 'loading', 'info');
            toastIcon.innerHTML = '';
            toastMessage.textContent = '';
          }, 500);
        }, duration);
      }
    }
    function hideToast() {
      if (!toast) return;
      clearTimeout(toastTimer);
      // ★★★ CAMBIO: Usar clase 'hiding' para la transición de CSS, si existe, o solo remover 'show' ★★★
      toast.classList.remove('show');
      toast.classList.add('hiding'); // Esta clase se usará en CSS para la transición
      setTimeout(() => {
        toast.classList.remove('hiding', 'success', 'error', 'loading', 'info');
        toastIcon.innerHTML = '';
        toastMessage.textContent = '';
      }, 500);
    }
    const showMessage = showToast;
    const clearMessage = hideToast;
    
    // --- HELPER WEB SHARE API (sin cambios) ---
    function dataURLtoFile(dataUrl, filename) {
      if (!dataUrl) return null;
      try {
        const arr = dataUrl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
      } catch (e) { console.error("Error al convertir Data URL a File:", e); return null; }
    }

    // --- Lógica del Canvas de Firma (sin cambios) ---
    const ctx = firmaCanvas.getContext('2d');
    function setupCanvas(){
      const modalBody = firmaModal.querySelector('.modal-body');
      if (!modalBody) return;
      const rect = modalBody.getBoundingClientRect();
      const style = window.getComputedStyle(modalBody);
      const paddingLeft = parseFloat(style.paddingLeft);
      const paddingRight = parseFloat(style.paddingRight);
      const displayW = rect.width - paddingLeft - paddingRight;
      const displayH = 200; 
      const ratio = window.devicePixelRatio || 1;
      firmaCanvas.style.width = displayW + 'px';
      firmaCanvas.style.height = displayH + 'px';
      firmaCanvas.width = Math.floor(displayW * ratio);
      firmaCanvas.height = Math.floor(displayH * ratio);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      clearCanvas();
    }
    let hasSigned = false;
    function clearCanvas(){
      ctx.clearRect(0,0,firmaCanvas.width, firmaCanvas.height);
      ctx.save();
      ctx.strokeStyle = '#cfe6ff';
      ctx.setLineDash([6,6]);
      const w = (firmaCanvas.width/(window.devicePixelRatio||1)) -12;
      const h = (firmaCanvas.height/(window.devicePixelRatio||1)) -12;
      ctx.strokeRect(6,6, w, h);
      ctx.restore();
      hasSigned = false; 
    }
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const isHidden = firmaModal.classList.contains('hidden');
          if (!isHidden) { setupCanvas(); }
        }
      }
    });
    observer.observe(firmaModal, { attributes: true });
    let drawing=false;
    function getPos(e){
      const r = firmaCanvas.getBoundingClientRect();
      let clientX, clientY;
      if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = e.clientX; clientY = e.clientY; }
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function pointerDown(e){ e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function pointerMove(e){ if(!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#05304b'; ctx.stroke(); hasSigned = true; }
    function pointerUp(e){ drawing = false; }
    firmaCanvas.addEventListener('touchstart', pointerDown, {passive:false});
    firmaCanvas.addEventListener('touchmove', pointerMove, {passive:false});
    firmaCanvas.addEventListener('touchend', pointerUp);
    firmaCanvas.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    limpiarFirma.addEventListener('click', ()=>{ clearCanvas(); });

    // --- Lógica de Fotos (sin cambios) ---
    fotoBtn.addEventListener('click', () => { fotoInput.click(); });
    idFotoBtn.addEventListener('click', () => { idFotoInput.click(); });
    fotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { fotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      fotoPreview.innerHTML = `<img alt="foto paquete" src="${url}">`;
    });
    idFotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { idPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      idPreview.innerHTML = `<img alt="foto id" src="${url}">`;
    });

    // --- Lógica de Refresh (sin cambios) ---
    async function rebuildAutocomplete(){
      const paqs = await getAll('paquetes'); const doms = await getAll('domicilios');
      const nombres = new Set(); const paqsTxt = new Set();
      doms.forEach(d=>{ if(d.residentes) d.residentes.forEach(r=>nombres.add(r)); });
      paqs.forEach(p=>{ if(p.nombre) nombres.add(p.nombre); if(p.paqueteria) paqsTxt.add(p.paqueteria); });
      nombresList.innerHTML=''; paqList.innerHTML=''; domList.innerHTML='';
      nombres.forEach(n=>{ const o=document.createElement('option'); o.value=n; nombresList.appendChild(o); });
      paqsTxt.forEach(n=>{ const o=document.createElement('option'); o.value=n; paqList.appendChild(o); });
      doms.forEach(d=>{ const o=document.createElement('option'); o.value=d.calle; domList.appendChild(o); }); 
    }
    async function refreshDomicilios(){
      const doms = await getAll('domicilios'); tablaDomicilios.innerHTML='';
      doms.forEach(d=>{
        const row = document.createElement('div'); row.className='row';
        row.innerHTML = `<div class="info"><strong>${d.calle}</strong><div class="muted">${(d.residentes||[]).join(', ')}</div><div class="telefono"><span class="muted">Tel:</span> ${d.telefono || 'No registrado'}</div></div><div><button class="btn ghost" data-id="${d.id}" data-act="edit">Editar</button></div>`;
        tablaDomicilios.appendChild(row);
      });
    }
    async function refreshPaquetes(){
      const paqs = await getAll('paquetes'); const filter = buscarHist.value.toLowerCase(); const estadoF = filtroEstado.value;
      const desde = fechaDesde.valueAsDate; const hasta = fechaHasta.valueAsDate;
      const rows = paqs.filter(p=>{
        if(filter){ const found = (p.guia||'').toLowerCase().includes(filter) || (p.nombre||'').toLowerCase().includes(filter) || (p.estado||'').toLowerCase().includes(filter) || (p.domicilio||'').toLowerCase().includes(filter); if(!found) return false; }
        if(estadoF && p.estado !== estadoF) return false;
        const fechaPaquete = new Date(p.created);
        if(desde && fechaPaquete < desde) return false;
        if(hasta) { const hastaMañana = new Date(hasta); hastaMañana.setDate(hastaMañana.getDate() + 1); if (fechaPaquete >= hastaMañana) return false; }
        return true;
      }).sort((a,b)=>b.created - a.created);
      historialPaquetes.innerHTML = '';
      const fallbackGuardiaImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjUiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy45M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4=';
      rows.forEach(p=>{
        const card = document.createElement('div'); card.className = `historial-card estado-${p.estado || 'na'}`;
        let thumbsHTML = '';
        if(p.foto){ thumbsHTML += `<img src="${p.foto}" class="thumb" alt="Foto Paquete" data-paquete-id="${p.id}" data-type="foto">`; }
        if(p.idFoto){ thumbsHTML += `<img src="${p.idFoto}" class="thumb" alt="Foto ID" data-paquete-id="${p.id}" data-type="id">`; }
        if(p.firma){ thumbsHTML += `<img src="${p.firma}" class="thumb thumb-firma" alt="Firma" data-paquete-id="${p.id}" data-type="firma">`; }
        let actionsHTML = `<button class="btn ghost" data-id="${p.id}" data-act="view">Ver</button>`;
        if (userRol === 'admin') { actionsHTML += ` <button class="btn danger-ghost" data-id="${p.id}" data-act="delete">Eliminar</button>`; }
        const fotoRecibidoSrc = p.fotoRecibidoPor || fallbackGuardiaImg; const fotoEntregadoSrc = p.fotoEntregadoPor || fallbackGuardiaImg;
        
        card.innerHTML = `<div class="card-header"><strong>${p.domicilio || 'Sin domicilio'}</strong><span class="guia">Guía: ${p.guia || '—'} | Paquetería: ${p.paqueteria || 'N/A'} | Residente: ${p.nombre}</span></div><div class="card-body"><div class="card-section"><span class="label">Estado</span><span class="estado-tag">${p.estado === 'en_caseta' ? 'En Caseta' : 'Entregado'}</span></div>${p.comentarios ? `<div class="card-section"><span class="label">Comentarios</span><p class="comentarios">${p.comentarios}</p></div>` : ''}<div class="card-section"><span class="label">Trazabilidad</span><div class="trazabilidad"><div class="guardia-info"><img src="${fotoRecibidoSrc}" alt="Guardia que recibió" class="guardia-thumb"><div class="guardia-info-texto"><strong>Recibió:</strong> ${p.recibidoPor || '-'}<span class="fecha">${formatDate(p.created)}</span></div></div>${p.entregadoEn ? `<div class="guardia-info"><img src="${fotoEntregadoSrc}" alt="Guardia que entregó" class="guardia-thumb"><div class="guardia-info-texto"><strong>Entregó:</strong> ${p.entregadoPor || '-'}<span class="fecha">${formatDate(p.entregadoEn)}</span></div></div>` : ''}</div></div>${thumbsHTML ? `<div class="card-section"><span class="label">Galería</span><div class="galeria-thumbs">${thumbsHTML}</div></div>` : ''}</div><div class="card-footer">${actionsHTML}</div>`;

        card.querySelectorAll('.thumb, [data-act="view"]').forEach(el => { el.addEventListener('click', async () => { const id = el.dataset.paqueteId || el.dataset.id; const type = el.dataset.type || 'foto'; const paquete = await getByKey('paquetes', Number(id)); if (paquete) openViewerFor(paquete, type); }); });
        card.querySelectorAll('[data-act="delete"]').forEach(el => { el.addEventListener('click', async () => { if (userRol !== 'admin') return; const id = Number(el.dataset.id); const p = await getByKey('paquetes', id); if (!p) return; itemToDelete = { type: 'paquete', id: p.id }; deleteConfirmMsg.textContent = `¿Estás seguro de eliminar el paquete con guía ${p.guia} para ${p.nombre}? Esta acción no se puede deshacer.`; deleteConfirmModal.classList.remove('hidden'); }); });
        historialPaquetes.appendChild(card);
      });
      const totalMostrados = rows.length; const enCasetaMostrados = rows.filter(p => p.estado === 'en_caseta').length;
      historialContador.textContent = `Mostrando: ${totalMostrados} paquetes | En Caseta (filtrados): ${enCasetaMostrados}`;
    }
    function formatDate(ts){ if(!ts) return '-'; const d = new Date(ts); return d.toLocaleString(); }
    function formatLabelDate(dateString) { if (!dateString) return null; try { const parts = dateString.split('-'); const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const day = parseInt(parts[2], 10); const shortYear = year.toString().slice(-2); return `${day}/${month}/${shortYear}`; } catch (e) { return dateString; } }

    await rebuildAutocomplete(); await refreshDomicilios(); await refreshPaquetes();

    // --- Lógica de Sugerencias (sin cambios) ---
    guiaEl.addEventListener('input', async ()=>{
      clearMessage(); 
      const q = guiaEl.value.trim().toLowerCase();
      guiaSuggestions.innerHTML = '';
      if(!q) return;
      const paqs = await getAll('paquetes');
      const matches = paqs.filter(p => p.estado === 'en_caseta' && ((p.guia||'').toLowerCase().includes(q) || (p.nombre||'').toLowerCase().includes(q)));
      if(matches.length){
        const ul = document.createElement('ul');
        matches.slice(0,8).forEach(m=>{
          const li = document.createElement('li');
          li.textContent = `${m.guia} · ${m.nombre} · ${m.paqueteria||''}`;
          li.addEventListener('click', async ()=>{
            guiaEl.value = m.guia;
            nombreDest.value = m.nombre || '';
            paqueteriaInput.value = m.paqueteria || '';
            domicilioInput.value = m.domicilio || '';
            comentariosPaquete.value = m.comentarios || ''; 
            guiaSuggestions.innerHTML = '';
            if (m.foto) { fotoPreview.innerHTML = `<img alt="foto paquete existente" src="${m.foto}">`; } else { fotoPreview.innerHTML = ''; }
            fotoInput.value = ''; 
          });
          ul.appendChild(li);
        });
        guiaSuggestions.appendChild(ul);
      }
    });

    // --- Lógica de entrega múltiple (CORREGIDA para coincidencia EXACTA) ---
    const handleDomicilioInput = async () => {
      const dom = domicilioInput.value.trim();
      const domLower = dom.toLowerCase();
      
      // La búsqueda de entrega múltiple solo aplica si no hay guía
      if (!dom || guiaEl.value.trim().length > 0) { 
          // Ocultar modal si no hay domicilio o si se empezó a escribir una guía
          confirmEntregarVariosModal.classList.add('hidden');
          currentBatchToDeliver = [];
          return;
      }
      
      // Evitar ejecutar si ya estamos en un modal de confirmación
      if (!confirmEntregarModal.classList.contains('hidden') || !confirmEntregarVariosModal.classList.contains('hidden') || !firmaModal.classList.contains('hidden')) { return; }
      
      const paqs = await getAll('paquetes');
      
      // ★★★ CAMBIO CRÍTICO: Usar comparación estricta (===) para el domicilio ★★★
      const paquetesParaEntregar = paqs.filter(p => 
        p.domicilio && 
        p.domicilio.toLowerCase() === domLower && // <-- ¡CAMBIO AQUÍ! (Coincidencia Exacta)
        p.estado === 'en_caseta'
      );
      
      if (paquetesParaEntregar.length > 0) {
        currentBatchToDeliver = paquetesParaEntregar;
        
        domicilioVariosTxt.textContent = dom;
        
        listaPaquetesVarios.innerHTML = '<ul>' + paquetesParaEntregar.map(p => {
            const fotoMiniatura = p.foto ? `<img src="${p.foto}" class="thumb-miniatura" data-paquete-id="${p.id}" data-type="foto" alt="foto paquete">` : '';
            return `<li style="display: flex; align-items: center; gap: 8px;">${fotoMiniatura}<div><strong>${p.guia}</strong> - ${p.nombre}<div class="info-paquete">${p.paqueteria || 'Sin paquetería'} | Recibido: ${formatDate(p.created)}</div></div></li>`;
          }).join('') + '</ul>';
        
        confirmEntregarVariosModal.classList.remove('hidden');
      } else {
          // Si no hay coincidencias exactas y el modal está visible, lo ocultamos
          confirmEntregarVariosModal.classList.add('hidden');
          currentBatchToDeliver = [];
      }
    };
    const debouncedDomicilioSearch = () => {
      clearTimeout(domicilioDebounceTimer);
      domicilioDebounceTimer = setTimeout(handleDomicilioInput, 500); // Reduje el debounce a 500ms
    };
    domicilioInput.addEventListener('input', debouncedDomicilioSearch);
    domicilioInput.addEventListener('paste', debouncedDomicilioSearch);
    domicilioInput.addEventListener('change', debouncedDomicilioSearch);
    
    listaPaquetesVarios.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('thumb-miniatura')) {
        const paqueteId = Number(target.dataset.paqueteId);
        const tipoFoto = target.dataset.type;
        const paquete = currentBatchToDeliver.find(p => p.id === paqueteId);
        if (paquete) { openViewerFor(paquete, tipoFoto); }
      }
    });

    // ★★★ INICIO NUEVA FUNCIÓN CON NOMBRE PARA EVITAR DUPLICACIÓN DEL LISTENER ★★★
    async function handleRecibirPaquete(){
      clearMessage();
      const guia = guiaEl.value.trim();
      const nombre = nombreDest.value.trim();
      const domicilio = domicilioInput.value.trim(); // Obtener valor de domicilio
      const comentarios = comentariosPaquete.value.trim(); 
      const fotoActual = fotoInput.files[0]; 
      const fotoExistente = fotoPreview.querySelector('img') ? fotoPreview.querySelector('img').src : null; 
      
      // ★★★ CAMBIO: Validación de domicilio (obligatorio) ★★★
      if(!guia || !nombre || !domicilio){ showMessage('Guía, nombre y domicilio son obligatorios', 'error'); return; }
      
      if (!fotoActual && !fotoExistente) { showMessage('Es obligatorio tomar foto del paquete', 'error'); return; }
      showMessage('Guardando paquete...', 'loading', 0);
      const paqs = await getAll('paquetes');
      const p = paqs.find(x => x.guia === guia);
      if (p && p.estado === 'entregado') { showMessage('Ese paquete ya fue entregado', 'error'); return; }
      const fotoDataURL = fotoActual ? await compressImage(fotoActual) : fotoExistente;
      const paquete = { guia, nombre, paqueteria: paqueteriaInput.value, domicilio: domicilio, foto: fotoDataURL, estado: 'en_caseta', created: Date.now(), recibidoPor: user.nombre, fotoRecibidoPor: userFoto, comentarios: comentarios, entregadoPor: null, fotoEntregadoPor: null, entregadoEn: null, firma: null, idFoto: null };
      try{
        const id = p ? await putItem('paquetes', {...paquete, id: p.id}) : await addItem('paquetes', paquete);
        if (!p) { await addItem('historial',{paqueteId:id,estado:'en_caseta',usuario:user.nombre,fecha:Date.now(),nota:''}); }
        let notified = false;
        
        // LÓGICA DE NOTIFICACIÓN (Solo si está marcado)
        if (notificarSi.checked) {
          const dom = domicilioInput.value.trim(); let domInfo = null;
          if (dom) { const doms = await getAll('domicilios'); domInfo = doms.find(d => d.calle === dom); }
          const nombreRes = nombreDest.value.trim() || `residente del ${dom}`;
          const paqInfo = `Paquete: ${paqueteriaInput.value || 'N/A'}\nGuía: ${guia}`;
          const domInfoMsg = `Domicilio: ${dom || 'No especificado'}`;
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          const msg = `📦 *PAQUETE EN CASETA* 📦\nHola ${nombreRes}, se ha recibido 1 paquete para su domicilio.\n\n${domInfoMsg}\n${paqInfo}${comentariosMsg}\n\nRecibido por: ${user.nombre}.`;

          const fotoFile = dataURLtoFile(fotoDataURL, `paquete_${guia}.png`);
          const bannerDataURL = await createBannerImage('✅ Paquete en Caseta ✅');
          const bannerFile = dataURLtoFile(bannerDataURL, 'notificacion.png');

          const files = [];
          if (bannerFile) { files.push(bannerFile); }
          if (fotoFile) { files.push(fotoFile); }
          
          const shareDataWithFiles = { text: msg, files: files };
          const shareDataTextOnly = { text: msg };

          let canShareFiles = false;

          if (navigator.canShare && files.length > 1) { 
            try {
              if (navigator.canShare(shareDataWithFiles)) {
                 canShareFiles = true;
              }
            } catch (e) {
              console.warn("Error chequeando canShare con archivos:", e);
              canShareFiles = false;
            }
          }

          if (canShareFiles) {
            try { 
              // *** ÚNICA LLAMADA A navigator.share() ***
              await navigator.share(shareDataWithFiles); 
              notified = true; 
            } 
            catch (err) {
              console.warn("Web Share API (con 2 archivos) falló:", err); 
              notified = false; 
              if (err.name !== 'AbortError') { 
                if (domInfo && domInfo.telefono) { 
                  const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
                  window.open(url, '_blank'); 
                  notified = true; 
                } 
              }
            }
          } 
          else if (navigator.canShare && navigator.canShare(shareDataTextOnly)) {
             console.warn("No se pueden compartir archivos, compartiendo solo texto.");
             try {
                // *** ÚNICA LLAMADA A navigator.share() (Texto) ***
                await navigator.share(shareDataTextOnly);
                notified = true;
             } catch(err) {
                if (err.name !== 'AbortError' && domInfo && domInfo.telefono) {
                    const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
                    window.open(url, '_blank'); 
                    notified = true;
                }
             }
          }
          else if (domInfo && domInfo.telefono) { 
            console.log("Web Share API no soportada, usando fallback de WA."); 
            const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
            window.open(url, '_blank'); 
            notified = true; 
          }
        } 
        
        if(notified) { showMessage(p ? 'Paquete actualizado (Abriendo app...)' : 'Paquete registrado (Abriendo app...)', 'success', 4000); } 
        else { showMessage(p ? 'Paquete actualizado' : 'Paquete registrado', 'success'); }
        guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
        comentariosPaquete.value = ''; fotoPreview.innerHTML = ''; notificarSi.checked = true;
        await refreshPaquetes(); await rebuildAutocomplete();
      }catch(err){ const errorMsg = (err.name === 'ConstraintError' || (err.message && err.message.includes('key'))) ? 'Error: Guía duplicada.' : 'Error al guardar.'; showMessage(errorMsg, 'error'); console.error(err); }
    }
    // ★★★ FIN NUEVA FUNCIÓN CON NOMBRE PARA EVITAR DUPLICACIÓN DEL LISTENER ★★★

    // Eliminar cualquier listener previo que pudiera estar duplicando el evento (seguridad extra)
    recibirBtn.removeEventListener('click', handleRecibirPaquete);
    // Asignar el listener de forma limpia
    recibirBtn.addEventListener('click', handleRecibirPaquete);

    // --- FLUJO DE ENTREGA (sin cambios) ---
    entregarBtn.addEventListener('click', async ()=>{
      clearMessage(); currentBatchToDeliver = []; 
      const guia = guiaEl.value.trim();
      if(!guia){ showMessage('Escribe la guía del paquete a entregar', 'error'); return; }
      const paqs = await getAll('paquetes');
      const p = paqs.find(x=>x.guia===guia);
      if(!p){ showMessage('Paquete no encontrado', 'error'); return; }
      if (p.estado === 'entregado') { showMessage('Ese paquete ya fue entregado', 'error'); return; }
      confirmEntregarMsg.textContent = `¿Estás seguro de entregar el paquete ${p.guia} a ${p.nombre}?`;
      confirmEntregarModal.classList.remove('hidden');
    });
    cancelEntregarBtn.addEventListener('click', () => { confirmEntregarModal.classList.add('hidden'); });
    confirmEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden'); firmaModal.classList.remove('hidden');
      idPreview.innerHTML = ''; idFotoInput.value = ''; notificarEntregaSi.checked = true; clearCanvas();
    });
    cancelVariosBtn.addEventListener('click', () => { confirmEntregarVariosModal.classList.add('hidden'); currentBatchToDeliver = []; });
    confirmVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden'); firmaModal.classList.remove('hidden');
      idPreview.innerHTML = ''; idFotoInput.value = ''; notificarEntregaSi.checked = true; clearCanvas();
    });

    // --- MODAL DE FIRMA (CON CORRECCIÓN DE SHARE API v7 - Quitar Title) ---
    cerrarFirma.addEventListener('click', () => { firmaModal.classList.add('hidden'); currentBatchToDeliver = []; });
    guardarFirma.addEventListener('click', async ()=>{
      const idFotoFile = idFotoInput.files[0]; const idFotoPreviewSrc = idPreview.querySelector('img') ? idPreview.querySelector('img').src : null;
      if (!idFotoFile && !idFotoPreviewSrc) { showMessage('Es obligatorio tomar foto de ID', 'error'); return; }
      if (!hasSigned) { showMessage('Es obligatorio firmar en el recuadro', 'error'); return; }
      showMessage('Guardando firma y entrega...', 'loading', 0);
      const firmaDataURL = firmaCanvas.toDataURL('image/png');
      const idFotoDataURL = idFotoFile ? await compressImage(idFotoFile) : idFotoPreviewSrc;
      const entregadoPor = user.nombre; const entregadoEn = Date.now();
      let notified = false; let domInfo = null; let msg = ""; let shareTitle = ""; let comentarios = "";
      if (currentBatchToDeliver.length > 0) {
        const dom = currentBatchToDeliver[0].domicilio; comentarios = currentBatchToDeliver[0].comentarios || ""; 
        try {
          for (const p of currentBatchToDeliver) {
            p.estado = 'entregado'; p.firma = firmaDataURL; p.idFoto = idFotoDataURL; p.entregadoPor = entregadoPor; p.entregadoEn = entregadoEn; p.fotoEntregadoPor = userFoto; 
            await putItem('paquetes', p);
            await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:'Entrega en lote'});
          }
          if (dom) { const doms = await getAll('domicilios'); domInfo = doms.find(d => d.calle === dom); }
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          msg = `✅ *PAQUETES ENTREGADOS* ✅\nHola residente del ${dom}, se han entregado ${currentBatchToDeliver.length} paquetes en su domicilio.${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
          shareTitle = "Paquetes Entregados"; // Esta variable ya no se usa para 'share', pero se mantiene por si acaso
        } catch (err) { showMessage('Error al guardar entrega múltiple', 'error'); console.error(err); return; }
        currentBatchToDeliver = []; 
      } else {
        try {
          const guia = guiaEl.value.trim(); const paqs = await getAll('paquetes');
          const p = paqs.find(x=>x.guia===guia);
          if(!p){ firmaModal.classList.add('hidden'); showMessage('Paquete no encontrado', 'error'); return; }
          if (p.estado === 'entregado') { firmaModal.classList.add('hidden'); showMessage('Ese paquete ya fue entregado', 'error'); return; }
          p.estado = 'entregado'; p.firma = firmaDataURL; p.idFoto = idFotoDataURL; p.entregadoPor = entregadoPor; p.entregadoEn = entregadoEn; p.fotoEntregadoPor = userFoto;
          await putItem('paquetes', p);
          await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:''});
          comentarios = p.comentarios || ""; const dom = p.domicilio;
          if (dom) { const doms = await getAll('domicilios'); domInfo = doms.find(d => d.calle === dom); }
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          msg = `✅ *PAQUETE ENTREGADO* ✅\nHola ${p.nombre}, se ha entregado su paquete (Guía: ${p.guia}).${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
          shareTitle = "Paquete Entregado"; // Esta variable ya no se usa para 'share'
        } catch (err) { showMessage('Error al guardar la entrega', 'error'); console.error(err); return; }
      }
      if (notificarEntregaSi.checked) {
        const firmaFile = dataURLtoFile(firmaDataURL, `firma_entrega.png`); const idFile = dataURLtoFile(idFotoDataURL, `id_entrega.png`);
        const files = [];
        if (firmaFile) files.push(firmaFile); 
        if (idFile) files.push(idFile);
        
        // ★★★ La lógica de notificación de ENTREGA se mantiene intacta ★★★
        const shareDataWithFiles = { text: msg, files: files };
        const shareDataTextOnly = { text: msg };

        let canShareFiles = false;

        if (navigator.canShare && files.length > 1) { 
            try {
              if (navigator.canShare(shareDataWithFiles)) {
                 canShareFiles = true;
              }
            } catch (e) {
              console.warn("Error chequeando canShare con archivos (entrega):", e);
              canShareFiles = false;
            }
        }
        
        if (canShareFiles) {
          try { 
            await navigator.share(shareDataWithFiles); 
            notified = true; 
          } 
          catch (err) {
            console.warn("Web Share API (con 2 archivos) falló:", err);
            notified = false;
            if (err.name !== 'AbortError') { 
              if (domInfo && domInfo.telefono) { 
                const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
                window.open(url, '_blank'); 
                notified = true; 
              } 
            }
          }
        }
        else if (navigator.canShare && navigator.canShare(shareDataTextOnly)) {
           console.warn("No se pueden compartir archivos (entrega), compartiendo solo texto.");
           try {
              await navigator.share(shareDataTextOnly);
              notified = true;
           } catch(err) {
              if (err.name !== 'AbortError' && domInfo && domInfo.telefono) {
                  const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
                  window.open(url, '_blank'); 
                  notified = true;
              }
           }
        }
        else if (domInfo && domInfo.telefono) { 
          console.log("Web Share API no soportada (entrega), usando fallback de WA."); 
          const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; 
          window.open(url, '_blank'); 
          notified = true; 
        }
      } 
      if (notified) { showMessage('Entrega guardada. (Abriendo app...)', 'success', 4000); } 
      else { showMessage('Entrega guardada exitosamente', 'success'); }
      firmaModal.classList.add('hidden');
      guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
      comentariosPaquete.value = ''; fotoPreview.innerHTML = ''; idPreview.innerHTML = ''; idFotoInput.value = '';
      hasSigned = false; entregarVariosBtn.disabled = true; entregarVariosBtn.textContent = 'Entregar (Varios)';
      await refreshPaquetes();
    });

    // --- GUARDAR DOMICILIO (sin cambios) ---
    domForm.addEventListener('submit', async (e)=>{
      e.preventDefault(); clearMessage();
      const calle = document.getElementById('domCalle').value.trim(); const res1 = document.getElementById('domResidente1').value.trim();
      const nota = document.getElementById('domNota').value.trim(); const telefono = document.getElementById('domTelefono').value.trim();
      const cleanPhone = telefono.replace(/[^0-9]/g, ''); 
      if(telefono && (!cleanPhone || cleanPhone.length < 10)) { showMessage('Teléfono inválido. Use solo números', 'error'); return; }
      const otros = Array.from(document.querySelectorAll('.residenteField')).map(i=>i.value.trim()).filter(Boolean);
      const residentes = [res1, ...otros];
      showMessage('Guardando domicilio...', 'loading', 0);
      try{
        const id = await addItem('domicilios',{calle, residentes, nota, telefono: cleanPhone, created:Date.now()});
        showMessage('Domicilio guardado', 'success');
        domForm.reset(); moreResidents.innerHTML='';
        await refreshDomicilios(); await rebuildAutocomplete();
      }catch(err){ showMessage('Error al guardar domicilio', 'error'); console.error(err); }
    });

    // --- Lógica de Tablas (sin cambios) ---
    tablaDomicilios.addEventListener('click', async (e)=>{
      const act = e.target.dataset.act; const id = Number(e.target.dataset.id);
      if(act==='edit'){
        const d = await getByKey('domicilios', id); if(!d) return;
        document.getElementById('domCalle').value = d.calle;
        document.getElementById('domResidente1').value = (d.residentes && d.residentes[0]) || '';
        document.getElementById('domNota').value = d.nota || '';
        document.getElementById('domTelefono').value = d.telefono || '';
        showMessage('Datos cargados para editar.', 'info', 2000);
      }
    });
    deleteCancelBtn.addEventListener('click', () => { deleteConfirmModal.classList.add('hidden'); itemToDelete = { type: null, id: null }; });
    deleteConfirmBtn.addEventListener('click', async () => {
      if (userRol !== 'admin' || !itemToDelete.id) return;
      if (itemToDelete.type === 'usuario' && itemToDelete.id === user.id) {
         showMessage('No puedes eliminar tu propia cuenta', 'error');
         deleteConfirmModal.classList.add('hidden'); itemToDelete = { type: null, id: null }; return;
      }
      showMessage('Eliminando registro...', 'loading', 0);
      deleteConfirmModal.classList.add('hidden');
      try {
        if (itemToDelete.type === 'paquete') { await deleteItem('paquetes', itemToDelete.id); await refreshPaquetes(); } 
        else if (itemToDelete.type === 'usuario') { await deleteItem('users', itemToDelete.id); await refreshUsuarios(); }
        showMessage('Registro eliminado exitosamente', 'success');
      } catch (err) { showMessage('Error al eliminar el registro', 'error'); console.error(err); }
      itemToDelete = { type: null, id: null };
    });

    // --- Lógica del Visor (sin cambios) ---
    let currentGallery = []; let currentIndex = 0;
    function openViewerFor(p, type){
      currentGallery = [];
      if(p.foto) currentGallery.push({src:p.foto, meta:`Foto paquete — ${p.guia}`});
      if(p.idFoto) currentGallery.push({src:p.idFoto, meta:`ID — ${p.guia}`});
      if(p.firma) currentGallery.push({src:p.firma, meta:`Firma — ${p.guia}`});
      if(currentGallery.length===0) return;
      let desiredIndex = 0;
      if (type === 'id' && p.idFoto) { desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('ID')); } 
      else if (type === 'firma' && p.firma) { desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('Firma')); }
      currentIndex = desiredIndex >= 0 ? desiredIndex : 0;
      showGalleryImage(); imageViewer.classList.remove('hidden');
    }
    function showGalleryImage(){ const item = currentGallery[currentIndex]; if(!item) return; viewerImg.src = item.src; viewerMeta.textContent = item.meta; }
    prevImg.addEventListener('click', ()=>{ if(currentGallery.length===0) return; currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; showGalleryImage(); });
    nextImg.addEventListener('click', ()=>{ if(currentGallery.length===0) return; currentIndex = (currentIndex + 1) % currentGallery.length; showGalleryImage(); });
    closeImageViewer.addEventListener('click', ()=>{ imageViewer.classList.add('hidden'); viewerImg.src=''; });

    // --- Lógica de Filtros (sin cambios) ---
    buscarHist.addEventListener('input', refreshPaquetes);
    filtroEstado.addEventListener('change', refreshPaquetes);
    fechaDesde.addEventListener('change', (e) => { const formatted = formatLabelDate(e.target.value); const labelElement = e.target.parentElement; if (formatted) { fechaDesdeLabel.textContent = formatted; labelElement.classList.add('has-value'); } else { fechaDesdeLabel.textContent = '🗓️ Desde'; labelElement.classList.remove('has-value'); } refreshPaquetes(); });
    fechaHasta.addEventListener('change', (e) => { const formatted = formatLabelDate(e.target.value); const labelElement = e.target.parentElement; if (formatted) { fechaHastaLabel.textContent = formatted; labelElement.classList.add('has-value'); } else { fechaHastaLabel.textContent = '🗓️ Hasta'; labelElement.classList.remove('has-value'); } refreshPaquetes(); });
    
    
    // --- Lógica del Escáner (sin cambios) ---
    let isScannerActive = false;
    let cameraStream = null; 
    let zxingCodeReader = null; 
    let barcodeDetector = null; 
    let scanAnimationFrame = null; 
    function onCodeDetected(code) {
      if (!isScannerActive || !code) return;
      console.log("Código detectado:", code);
      if (guiaEl) { guiaEl.value = code; }
      stopScanner();
      showToast(`Código escaneado`, 'success');
      if (guiaEl) { guiaEl.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function stopScanner() {
      if (!isScannerActive) return;
      isScannerActive = false;
      if (zxingCodeReader) { zxingCodeReader.reset(); zxingCodeReader = null; }
      if (scanAnimationFrame) { cancelAnimationFrame(scanAnimationFrame); scanAnimationFrame = null; }
      barcodeDetector = null;
      if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; }
      if (scannerVideo) { scannerVideo.srcObject = null; }
      scannerModal.classList.add('hidden');
      scannerStatus.textContent = 'Iniciando cámara...';
      console.log("Escáner detenido.");
    }
    if (stopScannerBtn) { stopScannerBtn.addEventListener('click', stopScanner); }
    if (startScannerBtn) {
      startScannerBtn.addEventListener('click', async () => {
        if (isScannerActive) return;
        const hasZxing = typeof ZXing !== 'undefined';
        const hasBarcodeDetector = typeof window.BarcodeDetector !== 'undefined';
        if (!hasZxing && !hasBarcodeDetector) {
          showToast('Error: Librería de escáner no cargó.', 'error');
          console.error("No se encontró ni ZXing ni BarcodeDetector.");
          return;
        }
        scannerModal.classList.remove('hidden');
        isScannerActive = true;
        scannerStatus.textContent = 'Solicitando cámara...';
        try {
          const constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
          cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
          scannerVideo.srcObject = cameraStream;
          scannerVideo.play().catch(e => console.error("Error al reproducir video", e));
          scannerStatus.textContent = 'Apunte al código...';
          if (hasBarcodeDetector) {
            console.log("Usando API nativa: BarcodeDetector");
            barcodeDetector = new window.BarcodeDetector();
            const scanFrame = async () => {
              if (!isScannerActive || !barcodeDetector) return;
              try {
                if (scannerVideo.readyState >= 2) { 
                  const barcodes = await barcodeDetector.detect(scannerVideo);
                  if (barcodes.length > 0) {
                    onCodeDetected(barcodes[0].rawValue);
                  } else {
                    scanAnimationFrame = requestAnimationFrame(scanFrame);
                  }
                } else {
                  scanAnimationFrame = requestAnimationFrame(scanFrame);
                }
              } catch (e) {
                console.error("Error en frame de BarcodeDetector:", e);
                if (isScannerActive) {
                   scanAnimationFrame = requestAnimationFrame(scanFrame);
                }
              }
            };
            scanFrame();
          } else if (hasZxing) {
            console.log("Usando fallback: ZXing-js");
            zxingCodeReader = new ZXing.BrowserMultiFormatReader();
            zxingCodeReader.decodeFromStream(cameraStream, scannerVideo, (result, err) => {
              if (result) { onCodeDetected(result.getText()); }
              if (err && !(err instanceof ZXing.NotFoundException)) { console.error("Error de ZXing:", err); }
            });
          }
        } catch (err) {
          console.error("Error al iniciar el escáner:", err);
          let errorMsg = "Error al iniciar escáner.";
          if (err.name === 'NotAllowedError' || err.toString().includes('Permission')) { errorMsg = "Permiso de cámara denegado."; } 
          else if (err.name === 'NotFoundError' || err.name === 'NotReadableError') { errorMsg = "No se encontró cámara."; }
          if (location.protocol !== 'https:' && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) { errorMsg = "Pruebe en un servidor HTTPS (GitHub Pages)."; }
          showToast(errorMsg, 'error', 5000);
          stopScanner(); 
        }
      });
    }
    
    // --- Lógica de Respaldo (sin cambios) ---
    exportBackupBtn.addEventListener('click', async () => {
      if (userRol !== 'admin') return;
      showMessage('Generando respaldo...', 'loading', 0);
      try {
        const backupData = {
          users: await getAll('users'),
          domicilios: await getAll('domicilios'),
          paquetes: await getAll('paquetes'),
          historial: await getAll('historial'),
          metadata: { version: DB_VERSION, exportedAt: new Date().toISOString() }
        };
        const jsonString = JSON.stringify(backupData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `ctrl_paqueteria_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage('Respaldo exportado exitosamente', 'success');
      } catch (err) {
        showMessage('Error al generar el respaldo', 'error');
        console.error("Error al exportar:", err);
      }
    });
    restoreBackupBtn.addEventListener('click', () => {
      if (userRol !== 'admin') return;
      if (!confirm("¡ADVERTENCIA!\n\nEsto borrará TODOS los datos actuales y los reemplazará con los del archivo de respaldo.\n\n¿Estás seguro de continuar?")) {
        return;
      }
      restoreBackupInput.click();
    });
    restoreBackupInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showMessage('Restaurando respaldo...', 'loading', 0);
      try {
        const jsonString = await file.text();
        const backupData = JSON.parse(jsonString);
        if (!backupData.users || !backupData.paquetes || !backupData.domicilios) {
          throw new Error("El archivo de respaldo no es válido.");
        }
        await clearStore('paquetes');
        await clearStore('historial');
        await clearStore('domicilios');
        await clearStore('users');
        await bulkAdd('users', backupData.users);
        await bulkAdd('domicilios', backupData.domicilios);
        await bulkAdd('paquetes', backupData.paquetes);
        await bulkAdd('historial', backupData.historial);
        showMessage('Restauración completada.', 'success', 2000);
        setTimeout(() => {
          location.reload();
        }, 2100);
      } catch (err) {
        showMessage('Error al restaurar el archivo', 'error');
        console.error("Error al restaurar:", err);
      } finally {
        restoreBackupInput.value = '';
      }
    });

    // --- Funciones Admin (con corrección de color PDF) ---
    async function refreshUsuarios() {
      if (userRol !== 'admin') return;
      const users = await getAll('users');
      tablaUsuarios.innerHTML = '';
      if (users.length === 0) { tablaUsuarios.innerHTML = '<p class="muted">No hay usuarios registrados.</p>'; return; }
      users.forEach(u => {
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<div class="info" style="display: flex; align-items: center; gap: 10px;"><img src="${u.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjUiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy45M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4='}" class="guardia-thumb"><div><strong>${u.nombre}</strong><div class="muted">Usuario: ${u.usuario} | Rol: ${u.rol || 'guardia'}</div></div></div><div>${u.id === user.id ? '<span class="muted">(Tú)</span>' : `<button class="btn danger-ghost" data-id="${u.id}" data-act="delete_user">Eliminar</button>`}</div>`;
        tablaUsuarios.appendChild(row);
      });
    }
    tablaUsuarios.addEventListener('click', (e) => {
      const act = e.target.dataset.act; const id = Number(e.target.dataset.id);
      if (act === 'delete_user') {
        if (userRol !== 'admin' || id === user.id) return;
        const u = e.target.closest('.row').querySelector('.info strong').textContent;
        itemToDelete = { type: 'usuario', id: id };
        deleteConfirmMsg.textContent = `¿Estás seguro de eliminar al usuario ${u}? Esta acción no se puede deshacer.`;
        deleteConfirmModal.classList.remove('hidden');
      }
    });
    refreshUsersBtn.addEventListener('click', refreshUsuarios);
    downloadPdfBtn.addEventListener('click', descargarPDF);
    async function descargarPDF() {
      if (userRol !== 'admin') return;
      // ★★★ CORRECCIÓN: Doble chequeo aquí y mensaje de error más claro si falla. ★★★
      if (!jsPDF) { 
        showMessage('Error: La librería PDF (jsPDF) no cargó. Revise su conexión y recargue.', 'error'); 
        return; 
      }
      showMessage('Generando PDF... por favor espera', 'loading', 0);
      try {
        const doc = new jsPDF(); const allPaquetes = await getAll('paquetes'); const allDomicilios = await getAll('domicilios');
        const fechaHoy = new Date().toLocaleString();
        doc.setFontSize(18); doc.text('Reporte de Paquetería', 14, 22); doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Generado por: ${user.nombre} (${user.rol})`, 14, 28); doc.text(`Fecha: ${fechaHoy}`, 14, 34);
        const enCaseta = allPaquetes.filter(p => p.estado === 'en_caseta');
        // ★★★ CAMBIO: Color de encabezado de tabla a VERDE OSCURO (del theme) ★★★
        doc.autoTable({ startY: 40, head: [['Guía', 'Domicilio', 'Residente', 'Recibido (Fecha)', 'Recibido (Guardia)', 'Comentarios']], body: enCaseta.map(p => [ p.guia, p.domicilio, p.nombre, formatDate(p.created), p.recibidoPor, p.comentarios || '-' ]), headStyles: { fillColor: [10, 54, 10] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Paquetes Actualmente en Caseta', data.settings.margin.left, data.settings.top - 10); } });
        const entregados = allPaquetes.filter(p => p.estado === 'entregado').sort((a,b) => b.entregadoEn - a.entregadoEn).slice(0, 50);
        // ★★★ CAMBIO: Color de encabezado de tabla a VERDE PRIMARIO (del theme) ★★★
        doc.autoTable({ head: [['Guía', 'Domicilio', 'Residente', 'Entregado (Fecha)', 'Entregado (Guardia)', 'Comentarios']], body: entregados.map(p => [ p.guia, p.domicilio, p.nombre, formatDate(p.entregadoEn), p.entregadoPor, p.comentarios || '-' ]), headStyles: { fillColor: [40, 167, 69] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Últimos 50 Paquetes Entregados', data.settings.margin.left, data.settings.top - 10); } });
        doc.autoTable({ head: [['Domicilio', 'Residentes', 'Teléfono', 'Nota']], body: allDomicilios.map(d => [ d.calle, (d.residentes || []).join(', '), d.telefono || '-', d.nota || '-' ]), headStyles: { fillColor: [107, 114, 128] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Directorio de Domicilios', data.settings.margin.left, data.settings.top - 10); } });
        doc.save(`Reporte_CtrlPaqueteria_${new Date().toISOString().split('T')[0]}.pdf`);
        showMessage('PDF generado.', 'success');
      } catch (err) { showMessage('Error al generar el PDF', 'error'); console.error("Error PDF:", err); }
    }
    // --- FIN FUNCIONES ADMIN ---
    
  }
})();


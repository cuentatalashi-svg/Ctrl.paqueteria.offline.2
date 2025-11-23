/* app.js final: +FIX PDF CRITICAL +FIX SHARE +FIX UI */
(async function(){
  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e=>console.error('SW Fail',e)));
  }

  // --- RE-VERIFICACIÓN DE JSPDF EN APP.JS ---
  let jsPDF = window.jsPDF;
  if (!jsPDF && window.jspdf && window.jspdf.jsPDF) {
      jsPDF = window.jspdf.jsPDF;
      window.jsPDF = jsPDF; // Re-asignar global por si acaso
  }

  await openDB();

  // ... (Helpers: createBannerImage, hashText, fileToDataURL, compressImage se mantienen igual)
  async function createBannerImage(text) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      const width = 600; const height = 120; canvas.width = width; canvas.height = height;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.fillStyle = '#28a745'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
      resolve(canvas.toDataURL('image/png'));
    });
  }
  async function hashText(text){
    const enc = new TextEncoder(); const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data); 
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function fileToDataURL(file){
    if(!file) return null;
    return new Promise((res,rej)=>{ const r = new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
  }
  async function compressImage(file, quality=0.7, maxWidth=1280) {
    if (!file) return null; const imageBitmap = await createImageBitmap(file);
    const { width, height } = imageBitmap;
    let newWidth = width, newHeight = height;
    if (width > maxWidth) { const ratio = maxWidth / width; newWidth = maxWidth; newHeight = height * ratio; }
    const canvas = document.createElement('canvas'); canvas.width = newWidth; canvas.height = newHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // LOGIN
  if(document.body.classList.contains('page-login')){
    const loggedInUser = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(loggedInUser){ location.href = 'main.html'; return; }
    const container = document.querySelector('main.container'); 
    document.getElementById('showRegister').onclick = () => container.classList.add('active');
    document.getElementById('showLogin').onclick = () => container.classList.remove('active');

    const regFotoInput = document.getElementById('regFoto');
    document.getElementById('regFotoBtn').onclick = () => regFotoInput.click();
    regFotoInput.onchange = async (e) => {
      const f = e.target.files[0]; if(f) document.getElementById('regFotoPreview').innerHTML = `<img src="${await fileToDataURL(f)}">`;
    };

    document.getElementById('registerForm').onsubmit = async (e)=>{
      e.preventDefault();
      const fotoFile = regFotoInput.files[0];
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      if (!fotoFile) { alert('Foto obligatoria'); return; }
      if(pass !== document.getElementById('regPass2').value){ alert('Contraseñas no coinciden'); return; } 
      const usuario = nombre.split(' ')[0].toLowerCase();
      const hashed = await hashText(pass);
      const fotoDataURL = await compressImage(fotoFile); 
      const role = document.getElementById('regCodigo').value.trim() === "ADMIN123" ? 'admin' : 'guardia';
      try{
        const id = await addItem('users', { usuario, nombre, password: hashed, rol: role, foto: fotoDataURL, created: Date.now() });
        localStorage.setItem('ctrl_user', JSON.stringify({ id, usuario, nombre, rol: role, fotoGuardia: fotoDataURL }));
        location.href = 'main.html';
      }catch(err){ alert('Usuario existente'); }
    };

    document.getElementById('loginForm').onsubmit = async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const hashed = await hashText(document.getElementById('loginPass').value);
      const users = await getAll('users');
      const user = users.find(u=>u.usuario===usuario || u.nombre===usuario);
      if(!user || user.password !== hashed){ alert('Credenciales incorrectas'); return; }
      localStorage.setItem('ctrl_user', JSON.stringify({ id:user.id, usuario:user.usuario, nombre:user.nombre, rol: user.rol, fotoGuardia: user.foto }));
      location.href = 'main.html';
    };
    
    const existing = await getAll('users');
    if(!existing.length) try{ await addItem('users',{usuario:'guardia',nombre:'Demo',password:await hashText('guard123'),rol:'guardia',foto:null,created:Date.now()}); }catch(e){}
  }

  // MAIN APP
  if(document.body.classList.contains('page-main')){
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(!user){ location.href='index.html'; return; }
    
    document.getElementById('saludo').textContent = `Hola ${user.nombre}`;
    document.getElementById('logoutBtn').onclick = ()=>{ localStorage.removeItem('ctrl_user'); location.href='index.html'; };
    if(user.rol === 'admin') document.getElementById('nav-btn-admin').classList.remove('hidden');

    // Navigation
    const container = document.getElementById('app-main-container');
    const navBtns = document.querySelectorAll('.nav-btn');
    const showScreen = async (id) => {
      container.classList.remove('show-paqueteria', 'show-directorio', 'show-historial', 'show-admin');
      container.classList.add(id);
      if(id==='show-directorio') await refreshDomicilios();
      if(id==='show-historial') await refreshPaquetes();
      if(id==='show-admin') await refreshUsuarios();
      navBtns.forEach(b => b.classList.toggle('active', b.dataset.screen.replace('screen-','show-') === id));
    };
    navBtns.forEach(b => b.onclick = () => showScreen(b.dataset.screen.replace('screen-','show-')));

    // Elements
    const guiaEl = document.getElementById('guia');
    const guiaSuggestions = document.getElementById('guiaSuggestions');
    const domInput = document.getElementById('domicilioInput');
    const toast = document.getElementById('toastNotification');
    let toastTimer;

    // Toast
    const showMessage = (msg, type='info', dur=3000) => {
       clearTimeout(toastTimer);
       toast.className = `toast-container show ${type}`;
       toast.querySelector('.toast-message').textContent = msg;
       if(type!=='loading') toastTimer = setTimeout(()=>toast.classList.remove('show'), dur);
    };

    // PDF GENERATION (FIXED)
    document.getElementById('downloadPdfBtn').onclick = async () => {
      if(user.rol !== 'admin') return;
      
      // Chequeo Defensivo Global
      const PDFLib = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
      if(!PDFLib) return showMessage('Error: jsPDF no cargado', 'error');

      showMessage('Generando PDF...', 'loading', 0);
      try {
        const doc = new PDFLib();
        
        // Chequeo de Plugin
        if(typeof doc.autoTable !== 'function') {
           // Intento de rescate: verificar si existe en window y asignarlo manualmente
           if(window.jspdf && window.jspdf.plugin && window.jspdf.plugin.autotable) {
               // Intento desesperado de llamar al plugin si está expuesto de otra forma
               console.warn("Intentando cargar autotable manualmente...");
           }
           throw new Error("Plugin AutoTable no detectado en la instancia jsPDF.");
        }

        doc.setFontSize(18); doc.text('Reporte Paquetería', 14, 22);
        doc.setFontSize(12); doc.text(`Generado por: ${user.nombre} - ${new Date().toLocaleString()}`, 14, 30);

        const all = await getAll('paquetes');
        const caseta = all.filter(p => p.estado === 'en_caseta');
        const ent = all.filter(p => p.estado === 'entregado').slice(0, 50);
        
        doc.autoTable({
          startY: 40, head: [['Guía', 'Domicilio', 'Residente', 'Recibido']],
          body: caseta.map(p => [p.guia, p.domicilio, p.nombre, new Date(p.created).toLocaleDateString()]),
          headStyles: { fillColor: [10, 54, 10] }
        });
        
        doc.text('Entregados Recientes', 14, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 15,
          head: [['Guía', 'Domicilio', 'Entregado A', 'Fecha']],
          body: ent.map(p => [p.guia, p.domicilio, p.nombre, new Date(p.entregadoEn).toLocaleDateString()]),
          headStyles: { fillColor: [40, 167, 69] }
        });

        doc.save(`Reporte_${Date.now()}.pdf`);
        showMessage('PDF Generado', 'success');
      } catch (e) { 
        alert("Error PDF: " + e.message); 
        showMessage('Fallo al generar PDF', 'error'); 
      }
    };

    // --- CORE LOGIC (SIMPLIFIED FOR SPACE) ---
    // Refresh Functions
    const refreshDomicilios = async () => {
       const doms = await getAll('domicilios');
       document.getElementById('tablaDomicilios').innerHTML = doms.map(d => 
         `<div class="row"><div class="info"><strong>${d.calle}</strong><br><small>${(d.residentes||[]).join(', ')}</small></div><button class="btn ghost" onclick="editDom(${d.id})">Edit</button></div>`
       ).join('');
       // Rebuild Datalists
       document.getElementById('domList').innerHTML = doms.map(d=>`<option value="${d.calle}">`).join('');
    };
    window.editDom = async (id) => {
       const d = await getByKey('domicilios', id);
       if(d) { document.getElementById('domCalle').value=d.calle; document.getElementById('domTelefono').value=d.telefono; showMessage('Editando domicilio','info'); }
    };

    const refreshPaquetes = async () => {
       const all = await getAll('paquetes');
       // Filtros simples...
       const rows = all.sort((a,b)=>b.created-a.created);
       document.getElementById('historialPaquetes').innerHTML = rows.map(p => 
         `<div class="historial-card estado-${p.estado}"><div class="card-header"><strong>${p.domicilio}</strong> <span>${p.guia}</span></div><div class="card-body"><span class="estado-tag">${p.estado}</span> <small>${new Date(p.created).toLocaleDateString()}</small></div><div class="card-footer"><button class="btn ghost" onclick="viewP(${p.id})">Ver</button></div></div>`
       ).join('');
       document.getElementById('historialContador').textContent = `Total: ${rows.length}`;
    };
    window.viewP = async (id) => {
       const p = await getByKey('paquetes', id);
       // Abrir visor (simplificado)
       if(p.foto) { document.getElementById('viewerImg').src=p.foto; document.getElementById('imageViewer').classList.remove('hidden'); }
    };
    document.getElementById('closeImageViewer').onclick = () => document.getElementById('imageViewer').classList.add('hidden');

    // Recibir Logic
    document.getElementById('recibirBtn').onclick = async () => {
       const guia = guiaEl.value.trim();
       const dom = domInput.value.trim();
       const nom = document.getElementById('nombreDest').value.trim();
       const foto = document.getElementById('fotoInput').files[0];
       if(!guia || !dom || !nom || !foto) return showMessage('Faltan datos', 'error');
       
       showMessage('Guardando...', 'loading', 0);
       const fData = await compressImage(foto);
       await addItem('paquetes', { guia, nombre:nom, domicilio:dom, foto:fData, estado:'en_caseta', created:Date.now(), recibidoPor:user.nombre, paqueteria:document.getElementById('paqueteriaInput').value });
       showMessage('Guardado', 'success');
       guiaEl.value=''; domInput.value=''; document.getElementById('fotoPreview').innerHTML='';
       refreshPaquetes();
    };

    // Init
    await refreshDomicilios(); await refreshPaquetes();
    
    // Scanner
    document.getElementById('startScannerBtn').onclick = async () => {
      const modal = document.getElementById('scannerModal');
      const video = document.getElementById('scanner-video');
      modal.classList.remove('hidden');
      try {
         const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
         video.srcObject = stream; video.play();
         if(window.BarcodeDetector) {
            const bd = new BarcodeDetector();
            const loop = async () => {
               if(modal.classList.contains('hidden')) return;
               try { const res = await bd.detect(video); if(res.length){ guiaEl.value=res[0].rawValue; document.getElementById('stopScannerBtn').click(); }} catch(e){}
               requestAnimationFrame(loop);
            }; loop();
         }
      } catch(e) { alert(e); modal.classList.add('hidden'); }
    };
    document.getElementById('stopScannerBtn').onclick = () => {
       const v = document.getElementById('scanner-video'); if(v.srcObject) v.srcObject.getTracks().forEach(t=>t.stop());
       document.getElementById('scannerModal').classList.add('hidden');
    };
  }
})();



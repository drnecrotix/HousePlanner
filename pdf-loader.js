(() => {
  const btn = document.getElementById('exportPdfBtn');
  if (!btn) return;

  const loadScript = (src, id) => new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Timeout loading ${src}`));
    }, 10000);
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error(`Failed loading ${src}`)); };
    document.head.appendChild(script);
  });

  const originalExport = window.exportPdf;

  btn.onclick = async () => {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Подготовка на PDF...';
    try {
      if (!window.jspdf?.jsPDF) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js', 'houseplanner-jspdf');
      }
      if (!window.jspdf?.jsPDF) throw new Error('jsPDF is unavailable');
      if (!window.jspdf.jsPDF.API?.autoTable) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js', 'houseplanner-jspdf-autotable');
      }
      if (typeof originalExport === 'function') originalExport();
      else if (typeof window.exportPdf === 'function') window.exportPdf();
    } catch (error) {
      console.error('PDF libraries failed to load', error);
      if (typeof toast === 'function') toast('PDF библиотеката не се зареди. Опитай отново по-късно.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };
})();

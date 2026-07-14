document.addEventListener('DOMContentLoaded', () => {
  // Views
  const loadingView = document.getElementById('contract-loading');
  const errorView = document.getElementById('contract-error');
  const contentView = document.getElementById('contract-content');

  // Parties & Content elements
  const clientNameMetas = document.querySelectorAll('.client-name-meta');
  const contractSigSection = document.getElementById('contract-sig-section');
  const signedBannerSection = document.getElementById('signed-banner-section');
  
  // Signed elements
  const signedByName = document.getElementById('signed-by-name');
  const signedOnDate = document.getElementById('signed-on-date');
  const signedSignatureImg = document.getElementById('signed-signature-img');
  
  // Signature form elements
  const sigForm = document.getElementById('contract-sig-form');
  const agreeCheck = document.getElementById('contract-agree-check');
  const sigFirstName = document.getElementById('sig-first-name');
  const sigLastName = document.getElementById('sig-last-name');
  const sigSubmitBtn = document.getElementById('sig-submit-btn');
  const sigBtnText = document.getElementById('sig-btn-text');
  const sigBtnSpinner = document.getElementById('sig-btn-spinner');
  
  // Canvas Signature Pad Elements
  const canvas = document.getElementById('sig-canvas');
  const clearBtn = document.getElementById('sig-clear-btn');
  const ctx = canvas.getContext('2d');
  
  // Tabs and Containers
  const tabDrawBtn = document.getElementById('tab-draw-btn');
  const tabTypeBtn = document.getElementById('tab-type-btn');
  const drawSigContainer = document.getElementById('draw-sig-container');
  const typeSigContainer = document.getElementById('type-sig-container');
  
  // Typed Signature Input & Preview
  const sigTypeInput = document.getElementById('sig-type-input');
  const sigTypePreview = document.getElementById('sig-type-preview');
  
  // Modal
  const modal = document.getElementById('contract-acceptance-modal');
  const closeModalBtn = document.getElementById('close-contract-acceptance-btn');

  // Extract ID from query parameter: ?id=ID or pathname
  const urlParams = new URLSearchParams(window.location.search);
  let proposalId = urlParams.get('id');
  if (!proposalId) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1 && pathParts[0] === 'proposal') {
      proposalId = pathParts[1];
    }
  }

  let hasDrawn = false;
  let activeSigMode = 'draw'; // 'draw' or 'type'

  if (!proposalId) {
    showError();
  } else {
    fetchProposalDetails(proposalId);
  }

  // --- Tabs Toggle Logic ---
  tabDrawBtn.addEventListener('click', () => {
    activeSigMode = 'draw';
    tabDrawBtn.classList.add('active');
    tabTypeBtn.classList.remove('active');
    drawSigContainer.style.display = 'flex';
    typeSigContainer.style.display = 'none';
    
    // Resize/reinitialize canvas resolution after displaying it
    setupCanvasResolution();
  });

  tabTypeBtn.addEventListener('click', () => {
    activeSigMode = 'type';
    tabTypeBtn.classList.add('active');
    tabDrawBtn.classList.remove('active');
    typeSigContainer.style.display = 'flex';
    drawSigContainer.style.display = 'none';
    
    // Set initial signature text from name inputs if not typed yet
    if (sigTypeInput.value.trim() === '') {
      const firstNameVal = sigFirstName.value.trim();
      const lastNameVal = sigLastName.value.trim();
      if (firstNameVal || lastNameVal) {
        sigTypeInput.value = `${firstNameVal} ${lastNameVal}`;
        sigTypePreview.innerText = `${firstNameVal} ${lastNameVal}`;
      }
    }
  });

  // --- Typed Signature Preview Live Update ---
  sigTypeInput.addEventListener('input', () => {
    const val = sigTypeInput.value.trim();
    sigTypePreview.innerText = val || 'Your Signature';
  });

  // --- Signature Pad Setup ---
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  let drawing = false;
  let lastPos = { x: 0, y: 0 };

  // Helper to adjust canvas size for crisp rendering on high-DPI screens without clearing user input
  function setupCanvasResolution() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Check if user has already drawn something and we need to save the buffer
    let tempCanvas = null;
    if (hasDrawn) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Re-apply drawing context properties
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Restore previous drawing stretched to fit the new size
    if (hasDrawn && tempCanvas) {
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
    }
  }

  // Handle Mouse Events
  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    lastPos = getMousePos(canvas, e);
    hasDrawn = true;
    canvas.parentElement.classList.add('drawing-active');
  });

  canvas.addEventListener('mouseup', () => {
    drawing = false;
    canvas.parentElement.classList.remove('drawing-active');
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const currentPos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    lastPos = currentPos;
  });

  canvas.addEventListener('mouseleave', () => {
    drawing = false;
    canvas.parentElement.classList.remove('drawing-active');
  });

  // Handle Touch Events for Mobile Devices
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      drawing = true;
      lastPos = getTouchPos(canvas, e);
      hasDrawn = true;
      canvas.parentElement.classList.add('drawing-active');
      e.preventDefault(); // prevent scrolling
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    drawing = false;
    canvas.parentElement.classList.remove('drawing-active');
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!drawing || e.touches.length !== 1) return;
    const currentPos = getTouchPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    lastPos = currentPos;
    e.preventDefault(); // prevent scrolling
  }, { passive: false });

  // Clear Canvas Button
  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
  });

  function getMousePos(canvasDom, mouseEvent) {
    const rect = canvasDom.getBoundingClientRect();
    return {
      x: mouseEvent.clientX - rect.left,
      y: mouseEvent.clientY - rect.top
    };
  }

  function getTouchPos(canvasDom, touchEvent) {
    const rect = canvasDom.getBoundingClientRect();
    return {
      x: touchEvent.touches[0].clientX - rect.left,
      y: touchEvent.touches[0].clientY - rect.top
    };
  }

  // --- Signature Form Submit ---
  sigForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!agreeCheck.checked) {
      alert('You must check the agreement box before submitting.');
      return;
    }

    const firstName = sigFirstName.value.trim();
    const lastName = sigLastName.value.trim();
    let signature = '';

    if (activeSigMode === 'draw') {
      if (!hasDrawn) {
        alert('Please draw your signature in the signature box.');
        return;
      }
      signature = canvas.toDataURL(); // base64 canvas image data URL
    } else {
      const typedName = sigTypeInput.value.trim();
      if (!typedName) {
        alert('Please type your signature in the text box.');
        return;
      }
      
      // Generate a high-resolution base64 PNG image by drawing the typed name onto a hidden canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 600;
      tempCanvas.height = 180;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Background (transparent or white, let's use white for consistent display on dark elements)
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Cursive text styling
      tempCtx.fillStyle = '#1c1c1c';
      tempCtx.font = 'italic 58px "Allura", "Brush Script MT", cursive';
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';
      tempCtx.fillText(typedName, tempCanvas.width / 2, tempCanvas.height / 2);
      
      signature = tempCanvas.toDataURL();
    }

    setSubmitting(true);

    try {
      const contract = {
        firstName,
        lastName,
        signature,
        signedAt: new Date().toISOString()
      };

      // Save directly to Firebase Realtime Database
      await firebaseDb.ref('proposals/' + proposalId + '/contract').set(contract);
      modal.style.display = 'flex';
    } catch (err) {
      console.error('Sign submit failed:', err);
      alert('A database error occurred. Please try again: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  });

  closeModalBtn.addEventListener('click', () => {
    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocalFile ? `invoice.html?id=${proposalId}` : `/proposal/${proposalId}/invoice`;
  });

  // --- Fetch & Load Terms ---
  async function fetchProposalDetails(id) {
    try {
      // Fetch from Firebase Realtime Database
      const snapshot = await firebaseDb.ref('proposals/' + id).once('value');
      let proposal = snapshot.val();
      
      if (!proposal) {
        console.log(`Proposal ${id} not found in Firebase. Checking server data fallback...`);
        const response = await fetch('/data/proposals.json');
        if (response.ok) {
          const serverProposals = await response.json();
          proposal = serverProposals.find(p => p.id === id);
          if (proposal) {
            // Seed this specific proposal into Firebase
            await firebaseDb.ref('proposals/' + id).set(proposal);
            console.log(`Imported proposal ${id} from server data into Firebase.`);
          }
        }
      }

      if (!proposal) {
        showError();
        return;
      }
      
      // Crucial flow logic: if client details are NOT recorded first, redirect back
      if (!proposal.approval) {
        alert('Please approve and enter your client contact details before executing the styling agreement.');
        const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        window.location.href = isLocalFile ? `proposal.html?id=${id}` : `/proposal/${id}`;
        return;
      }

      renderAgreement(proposal);
    } catch (err) {
      console.error('Error loading proposal agreement details:', err);
      showError();
    }
  }

  function showError() {
    loadingView.style.display = 'none';
    errorView.style.display = 'block';
  }

  function renderAgreement(proposal) {
    // Fill client name metas in Parties text
    const clientFullName = `${proposal.approval.firstName} ${proposal.approval.lastName}`;
    clientNameMetas.forEach(meta => {
      meta.innerText = clientFullName;
    });

    // Check if contract is already signed
    if (proposal.contract) {
      contractSigSection.style.display = 'none';
      
      // Populate signed banner details
      const signedDate = new Date(proposal.contract.signedAt);
      const formattedSignedDate = signedDate.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      signedByName.innerText = `${proposal.contract.firstName} ${proposal.contract.lastName}`;
      signedOnDate.innerText = formattedSignedDate;
      signedSignatureImg.src = proposal.contract.signature;
      const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      document.getElementById('view-invoice-link').href = isLocalFile ? `invoice.html?id=${proposalId}` : `/proposal/${proposalId}/invoice`;
      signedBannerSection.style.display = 'block';
    } else {
      // Clear previous canvas drawing state
      signedBannerSection.style.display = 'none';
      contractSigSection.style.display = 'block';
      
      // Pre-fill Name fields from the client details submitted in Step 1
      sigFirstName.value = proposal.approval.firstName || '';
      sigLastName.value = proposal.approval.lastName || '';
      
      // Initialize canvas drawing settings after it is displayed
      setTimeout(() => {
        setupCanvasResolution();
      }, 50);
    }

    loadingView.style.display = 'none';
    contentView.style.display = 'block';
  }

  function setSubmitting(isSubmitting) {
    if (isSubmitting) {
      sigSubmitBtn.disabled = true;
      sigBtnText.style.display = 'none';
      sigBtnSpinner.style.display = 'inline-block';
    } else {
      sigSubmitBtn.disabled = false;
      sigBtnText.style.display = 'inline';
      sigBtnSpinner.style.display = 'none';
    }
  }

  // Handle window resizing and zoom shifts smoothly
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (activeSigMode === 'draw') {
        setupCanvasResolution();
      }
    }, 150);
  });
});

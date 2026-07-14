document.addEventListener('DOMContentLoaded', () => {
  // Page elements
  const logoutBtn = document.getElementById('logout-btn');
  const displayUser = document.getElementById('display-user');
  const newProposalBtn = document.getElementById('new-proposal-btn');
  const proposalsGrid = document.getElementById('proposals-grid-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // Modal elements
  const modalOverlay = document.getElementById('proposal-modal-overlay');
  const modalTitleText = document.getElementById('modal-title-text');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  
  // Form fields
  const formElement = document.getElementById('proposal-form');
  const propIdField = document.getElementById('proposal-id');
  const propTitleField = document.getElementById('prop-title');
  const propSubtitleField = document.getElementById('prop-subtitle');
  const propClientNameField = document.getElementById('prop-client-name');
  const propClientEmailField = document.getElementById('prop-client-email');
  const propSendEmailField = document.getElementById('prop-send-email');
  const propPriceField = document.getElementById('prop-price');
  const propTaxField = document.getElementById('prop-tax');
  const inclusionsContainer = document.getElementById('inclusions-editor-container');
  const roomsContainer = document.getElementById('rooms-editor-container');
  const addInclusionBtn = document.getElementById('add-inclusion-btn');
  const addRoomBtn = document.getElementById('add-room-btn');
  
  // Toast
  const toastBanner = document.getElementById('toast-banner');

  let activeProposals = [];

  // Local storage helpers
  function getLocalProposals() {
    const data = localStorage.getItem('proposals');
    return data ? JSON.parse(data) : [];
  }

  function saveLocalProposals(proposals) {
    localStorage.setItem('proposals', JSON.stringify(proposals));
  }

  // --- Xero Integration Status ---
  const xeroStatusDot = document.getElementById('xero-status-dot');
  const xeroStatusText = document.getElementById('xero-status-text');
  const xeroConnectBtn = document.getElementById('xero-connect-btn');
  const xeroDisconnectBtn = document.getElementById('xero-disconnect-btn');

  async function checkXeroConnection() {
    if (!xeroStatusDot || !xeroStatusText) return;
    try {
      const res = await fetch('http://localhost:5000/auth/status');
      if (res.ok) {
        const status = await res.json();
        if (status.connected) {
          xeroStatusDot.style.backgroundColor = '#2e7d32'; // green
          xeroStatusText.innerText = `Connected: ${status.tenantName || 'Xero Org'}`;
          xeroConnectBtn.style.display = 'none';
          xeroDisconnectBtn.style.display = 'inline-block';
        } else {
          xeroStatusDot.style.backgroundColor = '#ff9800'; // orange
          xeroStatusText.innerText = 'Xero Disconnected';
          xeroConnectBtn.style.display = 'inline-block';
          xeroDisconnectBtn.style.display = 'none';
        }
      } else {
        throw new Error('Status check response not OK');
      }
    } catch (err) {
      console.warn('Xero Integration Server is offline or unreachable:', err);
      xeroStatusDot.style.backgroundColor = '#888888'; // grey
      xeroStatusText.innerText = 'Xero Server Offline';
      xeroConnectBtn.style.display = 'none';
      xeroDisconnectBtn.style.display = 'none';
    }
  }

  if (xeroDisconnectBtn) {
    xeroDisconnectBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('Are you sure you want to disconnect from Xero?')) return;
      try {
        const res = await fetch('http://localhost:5000/auth/disconnect');
        if (res.ok) {
          showToast('Disconnected from Xero successfully.');
          checkXeroConnection();
        } else {
          alert('Failed to disconnect from Xero.');
        }
      } catch (err) {
        console.error('Disconnect call failed:', err);
        alert('Could not reach backend to disconnect.');
      }
    });
  }




  // Event Listeners
  logoutBtn.addEventListener('click', handleLogout);
  newProposalBtn.addEventListener('click', () => openProposalModal());
  modalCloseBtn.addEventListener('click', closeProposalModal);
  modalCancelBtn.addEventListener('click', closeProposalModal);
  modalSaveBtn.addEventListener('click', handleSaveProposal);
  
  addInclusionBtn.addEventListener('click', () => addInclusionRow(''));
  addRoomBtn.addEventListener('click', () => addRoomCard('', []));  // Monitor authentication state
  firebaseAuth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
    } else {
      displayUser.innerText = `Logged in as ${user.email}`;
      // Setup real-time proposals synchronization
      setupProposalsSync();
      // Check Xero connection status
      checkXeroConnection();
    }
  });


  // --- Auth Functions ---
  async function handleLogout() {
    try {
      await firebaseAuth.signOut();
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  // --- Proposal Fetching & Rendering (Real-time Sync) ---
  function setupProposalsSync() {
    loadingIndicator.style.display = 'block';
    
    // Real-time listener for proposals
    firebaseDb.ref('proposals').on('value', async (snapshot) => {
      const data = snapshot.val() || {};
      activeProposals = Object.values(data);
      
      // If database is empty, seed it once from server data
      if (activeProposals.length === 0) {
        try {
          console.log('Firebase Database empty. Seeding from server proposals...');
          const res = await fetch('/data/proposals.json');
          if (res.ok) {
            const serverProposals = await res.json();
            const updates = {};
            serverProposals.forEach(prop => {
              updates[prop.id] = prop;
            });
            await firebaseDb.ref('proposals').update(updates);
            console.log('Seeded Firebase Realtime Database successfully.');
            return;
          }
        } catch (e) {
          console.warn('Failed to seed Firebase Database from server:', e);
        }
      }
      
      // Sort by creation date descending
      activeProposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Clear grid and render
      const cards = proposalsGrid.querySelectorAll('.proposal-card, .no-proposals');
      cards.forEach(card => card.remove());
      
      loadingIndicator.style.display = 'none';
      
      if (activeProposals.length === 0) {
        renderNoProposals();
      } else {
        activeProposals.forEach(prop => renderProposalCard(prop));
      }
    }, (err) => {
      console.error('Firebase DB listen error:', err);
      loadingIndicator.style.display = 'none';
      proposalsGrid.innerHTML += `
        <div class="no-proposals" style="border-color: var(--accent-danger);">
          <h3>Database Connection Error</h3>
          <p>${err.message}</p>
        </div>
      `;
    });
  }

  function renderNoProposals() {
    proposalsGrid.innerHTML += `
      <div class="no-proposals">
        <h3>No proposals found</h3>
        <p>Start by creating your first property styling package!</p>
        <button id="no-prop-create-btn" class="btn btn-gold btn-sm" style="font-size: 0.75rem;">+ Create Package</button>
      </div>
    `;
    
    document.getElementById('no-prop-create-btn')?.addEventListener('click', () => openProposalModal());
  }

  function renderProposalCard(prop) {
    const card = document.createElement('div');
    card.className = 'proposal-card';
    card.id = `card-${prop.id}`;
    
    const formattedDate = new Date(prop.createdAt).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
    const publicUrl = isLocalFile ? `${baseUrl}/proposal.html?id=${prop.id}` : `${window.location.origin}/proposal/${prop.id}`;

    // Generate approval HTML if approved
    let approvalHTML = '';
    let approvalBadge = '';
    
    if (prop.approval) {
      if (prop.contract) {
        const isPaid = prop.payment && prop.payment.status === 'Paid';
        if (isPaid) {
          approvalBadge = `
            <div style="display: flex; gap: 6px; float: right; margin-top: 5px;">
              <span style="background-color: #2e7d32; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Signed</span>
              <span style="background-color: #00b7f1; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Paid</span>
            </div>
          `;
        } else {
          approvalBadge = `<span style="background-color: #2e7d32; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; float: right; margin-top: 5px;">Signed &amp; Approved</span>`;
        }
        
        const signedDate = new Date(prop.contract.signedAt).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        
        approvalHTML = `
          <div style="margin-top: 15px; padding: 12px; background-color: var(--accent-gold-light); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-primary);">
            <div style="font-weight: 600; color: var(--accent-bronze); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Client Details &amp; Contract:</div>
            <div style="margin-bottom: 3px;"><strong>Name:</strong> ${escapeHTML(prop.approval.firstName)} ${escapeHTML(prop.approval.lastName)}</div>
            <div style="margin-bottom: 3px;"><strong>Contact:</strong> ${escapeHTML(prop.approval.email)} | ${escapeHTML(prop.approval.phone)}</div>
            <div style="line-height: 1.3; margin-bottom: 8px;"><strong>Billing:</strong> ${escapeHTML(prop.approval.addressLine1)}${prop.approval.addressLine2 ? ', ' + escapeHTML(prop.approval.addressLine2) : ''}, ${escapeHTML(prop.approval.city)}, ${escapeHTML(prop.approval.state)} ${escapeHTML(prop.approval.postcode)}</div>
            
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(173, 143, 101, 0.25); margin-bottom: 10px;">
              <span style="font-weight: 600; color: #2e7d32; text-transform: uppercase; font-size: 0.65rem; display: block; margin-bottom: 3px;">Agreement Executed</span>
              Signed by client on ${signedDate}
              ${isPaid ? `<span style="font-weight: 600; color: #00b7f1; text-transform: uppercase; font-size: 0.65rem; display: block; margin-top: 6px; margin-bottom: 3px;">Payment Received via Xero</span>Paid on ${new Date(prop.payment.paidAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(173, 143, 101, 0.15); padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; gap: 8px; width: 100%;">
                <a href="${isLocalFile ? `contract.html?id=${prop.id}` : `/proposal/${prop.id}/contract`}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--font-sans); text-decoration: none; flex-grow: 1; text-align: center;">View Contract</a>
                <a href="${isLocalFile ? `invoice.html?id=${prop.id}` : `/proposal/${prop.id}/invoice`}" target="_blank" class="btn btn-gold btn-sm" style="padding: 4px 8px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--font-sans); text-decoration: none; flex-grow: 1; text-align: center;">View Invoice</a>
              </div>
              <button class="btn btn-danger disapprove-btn" style="padding: 6px 12px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--font-sans); width: 100%;">Disapprove / Reset</button>
            </div>
          </div>
        `;
      } else {
        approvalBadge = `<span style="background-color: var(--accent-gold-dark); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; float: right; margin-top: 5px;">Approved</span>`;
        approvalHTML = `
          <div style="margin-top: 15px; padding: 12px; background-color: var(--accent-gold-light); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-primary);">
            <div style="font-weight: 600; color: var(--accent-bronze); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Client Approval Details:</div>
            <div style="margin-bottom: 3px;"><strong>Name:</strong> ${escapeHTML(prop.approval.firstName)} ${escapeHTML(prop.approval.lastName)}</div>
            <div style="margin-bottom: 3px;"><strong>Contact:</strong> ${escapeHTML(prop.approval.email)} | ${escapeHTML(prop.approval.phone)}</div>
            <div style="line-height: 1.3; margin-bottom: 10px;"><strong>Billing:</strong> ${escapeHTML(prop.approval.addressLine1)}${prop.approval.addressLine2 ? ', ' + escapeHTML(prop.approval.addressLine2) : ''}, ${escapeHTML(prop.approval.city)}, ${escapeHTML(prop.approval.state)} ${escapeHTML(prop.approval.postcode)}</div>
            <div style="display: flex; justify-content: flex-end; border-top: 1px solid rgba(173, 143, 101, 0.15); padding-top: 8px;">
              <button class="btn btn-danger disapprove-btn" style="padding: 6px 12px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--font-sans);">Disapprove / Reset</button>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="proposal-card-header">
        ${approvalBadge}
        <h3 class="proposal-card-title">${escapeHTML(prop.title)}</h3>
        <p class="proposal-card-subtitle">${escapeHTML(prop.subtitle || 'Property Styling Package')}</p>
        <span class="proposal-card-date">Created ${formattedDate}</span>
        ${prop.clientName ? `<div style="margin-top: 10px; font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-sans); display: flex; align-items: center; gap: 4px;"><strong>Client:</strong> <span>${escapeHTML(prop.clientName)}</span> <span style="opacity: 0.6;">(${escapeHTML(prop.clientEmail)})</span></div>` : ''}
      </div>
      
      <div class="proposal-card-meta">
        <div>
          <span class="proposal-card-price-label">Investment</span>
          <div class="proposal-card-price">$${prop.price} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-secondary);">${escapeHTML(prop.taxLabel)}</span></div>
        </div>
        <div class="proposal-card-rooms-count">
          <strong>${prop.rooms ? prop.rooms.length : 0}</strong> Rooms styled
        </div>
      </div>
      
      ${approvalHTML}
      
      <div class="proposal-card-actions" style="margin-top: 20px;">
        <button class="btn btn-outline edit-btn">Edit</button>
        <button class="btn btn-outline copy-link-btn">Copy Share Link</button>
        <a href="${isLocalFile ? `proposal.html?id=${prop.id}` : `/proposal/${prop.id}`}" target="_blank" class="btn btn-gold">View Page</a>
        <button class="btn btn-danger delete-btn">Delete</button>
      </div>
    `;

    // Add Action Event Listeners
    card.querySelector('.edit-btn').addEventListener('click', () => openProposalModal(prop.id));
    card.querySelector('.delete-btn').addEventListener('click', () => handleDeleteProposal(prop.id));
    
    const disapproveBtn = card.querySelector('.disapprove-btn');
    if (disapproveBtn) {
      disapproveBtn.addEventListener('click', () => handleDisapproveProposal(prop.id));
    }
    card.querySelector('.copy-link-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(publicUrl)
        .then(() => showToast('Share link copied to clipboard!'))
        .catch(err => {
          console.error('Could not copy link:', err);
          showToast('Failed to copy. URL: ' + publicUrl);
        });
    });

    proposalsGrid.appendChild(card);
  }

  // --- Dynamic Form Modifiers (Modal) ---
  function openProposalModal(id = null) {
    // Reset Form
    formElement.reset();
    propIdField.value = '';
    propClientNameField.value = '';
    propClientEmailField.value = '';
    propSendEmailField.checked = true;
    inclusionsContainer.innerHTML = '';
    roomsContainer.innerHTML = '';
    
    if (id) {
      // Edit mode
      modalTitleText.innerText = 'Edit Styling Proposal';
      const prop = activeProposals.find(p => p.id === id);
      if (!prop) return;

      propIdField.value = prop.id;
      propTitleField.value = prop.title;
      propSubtitleField.value = prop.subtitle;
      propClientNameField.value = prop.clientName || '';
      propClientEmailField.value = prop.clientEmail || '';
      propSendEmailField.checked = false; // default to false so we don't spam client on edit unless explicitly checked
      propPriceField.value = prop.price;
      propTaxField.value = prop.taxLabel || 'incl. GST';
      
      // Load inclusions
      if (prop.inclusions && prop.inclusions.length > 0) {
        prop.inclusions.forEach(inc => addInclusionRow(inc));
      } else {
        // Add one empty inclusion as helper
        addInclusionRow('');
      }
      
      // Load rooms
      if (prop.rooms && prop.rooms.length > 0) {
        prop.rooms.forEach(room => addRoomCard(room.name, room.items));
      } else {
        addRoomCard('', []);
      }
    } else {
      // Create Mode
      modalTitleText.innerText = 'Create Styling Proposal';
      propTaxField.value = 'incl. GST';
      // Add empty rows as defaults
      addInclusionRow('Professional delivery & installation');
      addInclusionRow('Six-weeks of furniture, art & decor hire');
      addInclusionRow('Scheduled collection at end of campaign');
      addRoomCard('', []);
    }

    modalOverlay.classList.add('active');
  }

  function closeProposalModal() {
    modalOverlay.classList.remove('active');
  }

  function addInclusionRow(value = '') {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    
    div.innerHTML = `
      <input type="text" class="form-control inclusion-input" placeholder="e.g. Six-weeks furniture hire" value="${escapeAttribute(value)}" required>
      <button type="button" class="btn-icon-danger remove-inclusion-btn" title="Remove Inclusion">&times;</button>
    `;
    
    div.querySelector('.remove-inclusion-btn').addEventListener('click', () => {
      div.remove();
    });
    
    inclusionsContainer.appendChild(div);
  }

  function addRoomCard(roomName = '', items = []) {
    const card = document.createElement('div');
    card.className = 'room-editor-card';
    
    card.innerHTML = `
      <div class="room-editor-header">
        <input type="text" class="form-control room-name-input" placeholder="e.g. Master Bedroom" value="${escapeAttribute(roomName)}" required style="flex-grow: 1;">
        <button type="button" class="btn btn-danger btn-sm remove-room-btn" style="padding: 8px 16px; font-size: 0.75rem;">Delete Room</button>
      </div>
      
      <div class="room-items-list">
        <!-- Item rows will append here -->
      </div>
      
      <div class="room-editor-actions">
        <button type="button" class="btn btn-outline btn-sm add-item-btn" style="padding: 6px 12px; font-size: 0.7rem;">+ Add Room Item</button>
      </div>
    `;

    const itemsListContainer = card.querySelector('.room-items-list');
    
    // Add event listeners
    card.querySelector('.remove-room-btn').addEventListener('click', () => {
      card.remove();
    });
    
    card.querySelector('.add-item-btn').addEventListener('click', () => {
      addRoomItemRow(itemsListContainer, '');
    });

    // Populate existing items
    if (items && items.length > 0) {
      items.forEach(item => addRoomItemRow(itemsListContainer, item));
    } else {
      addRoomItemRow(itemsListContainer, '');
    }

    roomsContainer.appendChild(card);
  }

  function addRoomItemRow(container, value = '') {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.style.marginBottom = '6px';
    
    div.innerHTML = `
      <input type="text" class="form-control room-item-input" placeholder="e.g. Queen Bed or Bedside Tables" value="${escapeAttribute(value)}" required>
      <button type="button" class="btn-icon-danger remove-item-btn" title="Remove Item" style="padding: 6px 10px;">&times;</button>
    `;
    
    div.querySelector('.remove-item-btn').addEventListener('click', () => {
      div.remove();
    });
    
    container.appendChild(div);
  }

  // Helper to send real proposal email via backend SMTP server
  async function sendProposalEmailClient(proposal, isNew) {
    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
    const proposalUrl = isLocalFile ? `${baseUrl}/proposal.html?id=${proposal.id}` : `${window.location.origin}/proposal/${proposal.id}`;
    
    console.log(`Initiating proposal email dispatch for ${proposal.clientEmail}...`);

    try {
      const response = await fetch('http://localhost:5000/api/email/send-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          clientEmail: proposal.clientEmail,
          clientName: proposal.clientName,
          proposalTitle: proposal.title,
          price: proposal.price
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.simulated) {
          showToast(isNew ? 'Proposal created! (Logged to server)' : 'Proposal updated! (Logged to server)');
          console.log('Email simulated successfully by server (SMTP not configured).');
        } else {
          showToast(isNew ? 'Proposal created & email sent!' : 'Proposal updated & email sent!');
          console.log('Email dispatched successfully via SMTP server.');
        }
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn('Backend SMTP service not reachable, falling back to local simulation:', err);
      // Fallback local simulation logs
      console.log(`\n--- Local Simulated Email ---`);
      console.log(`To: ${proposal.clientEmail}`);
      console.log(`Subject: Your Custom Property Staging Proposal: ${proposal.title}`);
      console.log(`Link: ${proposalUrl}`);
      console.log(`-----------------------------\n`);
      showToast(isNew ? 'Proposal created! (Logged to local console)' : 'Proposal updated! (Logged to local console)');
    }
  }

  // --- Form Submission / Proposal API ---
  async function handleSaveProposal() {
    const id = propIdField.value;
    const title = propTitleField.value.trim();
    const subtitle = propSubtitleField.value.trim();
    const clientName = propClientNameField.value.trim();
    const clientEmail = propClientEmailField.value.trim();
    const sendEmail = propSendEmailField.checked;
    const price = propPriceField.value.trim();
    const taxLabel = propTaxField.value.trim();

    if (!title) {
      alert('Proposal title is required.');
      return;
    }

    if (!clientName || !clientEmail) {
      alert('Client Name and Client Email are required.');
      return;
    }

    // Collect inclusions
    const inclusionInputs = inclusionsContainer.querySelectorAll('.inclusion-input');
    const inclusions = Array.from(inclusionInputs)
      .map(input => input.value.trim())
      .filter(val => val !== '');

    // Collect rooms and their items
    const roomCards = roomsContainer.querySelectorAll('.room-editor-card');
    const rooms = [];
    
    for (const card of roomCards) {
      const roomNameInput = card.querySelector('.room-name-input');
      const name = roomNameInput.value.trim();
      if (!name) continue; // skip rooms with empty names
      
      const itemInputs = card.querySelectorAll('.room-item-input');
      const items = Array.from(itemInputs)
        .map(input => input.value.trim())
        .filter(val => val !== '');
        
      rooms.push({ name, items });
    }

    // Generate random string ID for new proposals
    const targetId = id || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    try {
      if (id) {
        // Edit mode
        const existingProp = activeProposals.find(p => p.id === targetId);
        if (existingProp) {
          const updatedProposal = {
            ...existingProp,
            title,
            subtitle,
            clientName,
            clientEmail,
            price,
            taxLabel,
            inclusions,
            rooms,
            updatedAt: new Date().toISOString()
          };
          
          await firebaseDb.ref('proposals/' + targetId).set(updatedProposal);
          closeProposalModal();
          
          if (sendEmail) {
            sendProposalEmailClient(updatedProposal, false);
          } else {
            showToast('Proposal updated successfully!');
          }
        } else {
          alert('Proposal not found.');
        }
      } else {
        // Create mode
        const newProposal = {
          id: targetId,
          title,
          subtitle,
          clientName,
          clientEmail,
          price,
          taxLabel,
          inclusions,
          rooms,
          createdAt: new Date().toISOString()
        };
        
        await firebaseDb.ref('proposals/' + targetId).set(newProposal);
        closeProposalModal();
        
        if (sendEmail) {
          sendProposalEmailClient(newProposal, true);
        } else {
          showToast('Proposal created successfully!');
        }
      }
    } catch (err) {
      console.error('Failed to save proposal:', err);
      alert('A database error occurred. Could not save: ' + err.message);
    }
  }

  async function handleDeleteProposal(id) {
    if (!confirm('Are you sure you want to delete this styling proposal? This action is permanent.')) {
      return;
    }

    try {
      await firebaseDb.ref('proposals/' + id).remove();
      showToast('Proposal deleted.');
    } catch (err) {
      console.error('Delete request failed:', err);
      alert('Failed to delete proposal from Firebase: ' + err.message);
    }
  }

  async function handleDisapproveProposal(id) {
    if (!confirm('Are you sure you want to disapprove this proposal and reset its approval status? This will allow the client to approve it again.')) {
      return;
    }

    try {
      await firebaseDb.ref('proposals/' + id).update({
        approval: null,
        contract: null,
        payment: null
      });
      showToast('Proposal approval reset successfully.');
    } catch (err) {
      console.error('Disapprove request failed:', err);
      alert('A connection error occurred. Could not reset approval in Firebase: ' + err.message);
    }
  }

  // --- Helper UI Utilities ---
  function showToast(message) {
    toastBanner.innerText = message;
    toastBanner.classList.add('show');
    setTimeout(() => {
      toastBanner.classList.remove('show');
    }, 3000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
  }
});

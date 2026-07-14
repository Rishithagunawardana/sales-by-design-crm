document.addEventListener('DOMContentLoaded', () => {
  // Page elements
  const loadingView = document.getElementById('invoice-loading');
  const errorView = document.getElementById('invoice-error');
  const contentView = document.getElementById('invoice-content');

  // Meta elements
  const invNumber = document.getElementById('inv-number');
  const invDate = document.getElementById('inv-date');
  const invPropertyAddress = document.getElementById('inv-property-address');
  const invToDetails = document.getElementById('inv-to-details');
  const invReference = document.getElementById('inv-reference');

  // Table items body
  const itemsBody = document.getElementById('invoice-items-body');

  // Totals elements
  const invSubtotal = document.getElementById('inv-subtotal');
  const invTax = document.getElementById('inv-tax');
  const invTotal = document.getElementById('inv-total');
  const invRemainder = document.getElementById('inv-remainder');

  // Proof elements
  const proofClientName = document.getElementById('proof-client-name');
  const proofSignedDate = document.getElementById('proof-signed-date');
  const proofSigImg = document.getElementById('proof-sig-img');

  // Action buttons
  const backBtn = document.getElementById('invoice-back-btn');
  const printBtn = document.getElementById('invoice-print-btn');
  const pdfBtn = document.getElementById('invoice-pdf-btn');

  // Payment & Modal Elements
  const paidStamp = document.getElementById('invoice-paid-stamp');
  const paidStampDate = document.getElementById('stamp-paid-date');
  const paymentEftContainer = document.getElementById('payment-eft-container');
  const paymentOnlineContainer = document.getElementById('payment-online-container');
  const paymentReceiptBox = document.getElementById('payment-receipt-box');
  const receiptMethod = document.getElementById('receipt-method');
  const receiptTxId = document.getElementById('receipt-tx-id');
  const receiptDate = document.getElementById('receipt-date');
  const xeroPayBtn = document.getElementById('xero-pay-btn');

  const xeroModal = document.getElementById('xero-modal-overlay');
  const xeroModalClose = document.getElementById('xero-modal-close');
  const xeroBtnCancel = document.getElementById('xero-btn-cancel');
  const xeroPaymentForm = document.getElementById('xero-payment-form');
  const xeroCardNameInput = document.getElementById('xero-card-name');
  const xeroCardNumberInput = document.getElementById('xero-card-number');
  const xeroCardExpiryInput = document.getElementById('xero-card-expiry');
  const xeroCardCvvInput = document.getElementById('xero-card-cvv');
  const xeroLoader = document.getElementById('xero-loader');
  const xeroLoaderStatus = document.getElementById('xero-loader-status');
  const xeroSuccess = document.getElementById('xero-success');
  const xeroBtnDone = document.getElementById('xero-btn-done');
  const cardBrandIcon = document.getElementById('card-brand-icon');

  const xeroInvoiceNumText = document.getElementById('xero-invoice-num');
  const xeroClientNameText = document.getElementById('xero-client-name');
  const xeroAmountDueText = document.getElementById('xero-amount-due');

  let activeProposal = null;

  // Extract ID from query parameter: ?id=ID or pathname
  const urlParams = new URLSearchParams(window.location.search);
  let proposalId = urlParams.get('id');
  if (!proposalId) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1 && pathParts[0] === 'proposal') {
      proposalId = pathParts[1];
    }
  }

  let invoiceFilenameText = 'invoice';

  if (!proposalId) {
    showError();
  } else {
    fetchInvoiceDetails(proposalId);
  }

  // --- Button Event Listeners ---
  backBtn.addEventListener('click', () => {
    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocalFile ? `contract.html?id=${proposalId}` : `/proposal/${proposalId}/contract`;
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  pdfBtn.addEventListener('click', () => {
    const element = document.getElementById('invoice-container');
    const opt = {
      margin:       [10, 12, 10, 12], // top, left, bottom, right in mm
      filename:     `${invoiceFilenameText}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Disable download button temporarily to prevent double click
    pdfBtn.disabled = true;
    pdfBtn.innerText = 'Generating PDF...';

    html2pdf().set(opt).from(element).save()
      .then(() => {
        pdfBtn.disabled = false;
        pdfBtn.innerText = 'Download PDF';
      })
      .catch(err => {
        console.error('PDF creation error:', err);
        pdfBtn.disabled = false;
        pdfBtn.innerText = 'Download PDF';
        alert('An error occurred during PDF generation. Please try printing to PDF instead.');
      });
  });

  // --- API Fetching ---
  async function fetchInvoiceDetails(id) {
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

      // Guard check: Needs approval and contract to display tax invoice
      if (!proposal.approval || !proposal.contract) {
        showError();
        return;
      }

      renderInvoice(proposal);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      showError();
    }
  }

  function showError() {
    loadingView.style.display = 'none';
    errorView.style.display = 'block';
  }

  // --- Render Invoice ---
  function renderInvoice(proposal) {
    activeProposal = proposal;
    const approval = proposal.approval;
    const contract = proposal.contract;

    // Formatting date helper
    const signedDate = new Date(contract.signedAt);
    const dateStr = signedDate.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Invoice Numbers: SD-56016/06/2026 style
    const shortId = proposal.id.substring(0, 5).toUpperCase();
    const invoiceNumberText = `SD-${shortId}/${dateStr.replace(/\//g, '')}`;
    invoiceFilenameText = `Invoice-${invoiceNumberText.replace(/\//g, '-')}`;

    invNumber.innerText = `#${invoiceNumberText}`;
    invDate.innerText = dateStr;

    // Billing / Property Address
    const addressLine = `${approval.addressLine1}${approval.addressLine2 ? ', ' + approval.addressLine2 : ''}, ${approval.city} ${approval.state} ${approval.postcode}`;
    invPropertyAddress.innerText = addressLine;

    // Client "To" Details
    invToDetails.innerHTML = `
      <strong>${escapeHTML(approval.firstName)} ${escapeHTML(approval.lastName)}</strong><br>
      ${escapeHTML(approval.phone)}<br>
      ${escapeHTML(approval.email)}<br>
      <span style="display: inline-block; margin-top: 6px; color: var(--text-secondary);">
        ${escapeHTML(approval.addressLine1)}${approval.addressLine2 ? '<br>' + escapeHTML(approval.addressLine2) : ''}<br>
        ${escapeHTML(approval.city)}, ${escapeHTML(approval.state)} ${escapeHTML(approval.postcode)}
      </span>
    `;

    // Reference field
    invReference.innerText = `${approval.addressLine1.substring(0, 25)} / #${shortId}`;

    // --- Math Calculations ---
    const totalAmount = parseFloat(proposal.price.replace(/,/g, '')) || 0;
    
    // Check if GST is included
    const hasGST = proposal.taxLabel && proposal.taxLabel.toLowerCase().includes('gst');
    
    let subtotalAmount = totalAmount;
    let taxAmount = 0;
    let taxPercentText = '0%';

    if (hasGST) {
      taxAmount = totalAmount / 11;
      subtotalAmount = totalAmount - taxAmount;
      taxPercentText = '10%';
    }

    // --- Inject Items rows ---
    itemsBody.innerHTML = '';

    // 1. Main Package Item Row
    const mainRow = document.createElement('tr');
    mainRow.className = 'main-item-row';
    mainRow.innerHTML = `
      <td>
        <strong>${escapeHTML(proposal.title)}</strong>
        <div style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary); margin-top: 4px;">
          ${escapeHTML(proposal.subtitle || 'Complete campaign staging setup')}
        </div>
      </td>
      <td style="text-align: center;">1</td>
      <td style="text-align: center;">${taxPercentText}</td>
      <td style="text-align: right;">${formatCurrency(subtotalAmount)}</td>
      <td style="text-align: right;">${formatCurrency(subtotalAmount)}</td>
    `;
    itemsBody.appendChild(mainRow);

    // 2. Inclusions Row
    if (proposal.inclusions && proposal.inclusions.length > 0) {
      const incRow = document.createElement('tr');
      
      let inclusionsListHTML = '<ul class="invoice-item-sub-list">';
      proposal.inclusions.forEach(inc => {
        inclusionsListHTML += `<li>${escapeHTML(inc)}</li>`;
      });
      inclusionsListHTML += '</ul>';

      incRow.innerHTML = `
        <td>
          <strong style="color: var(--accent-bronze);">Service Inclusions</strong>
          ${inclusionsListHTML}
        </td>
        <td style="text-align: center; color: var(--text-muted);">0</td>
        <td style="text-align: center; color: var(--text-muted);">-</td>
        <td style="text-align: right; color: var(--text-muted);">$0.00</td>
        <td style="text-align: right; color: var(--text-muted);">$0.00</td>
      `;
      itemsBody.appendChild(incRow);
    }

    // 3. Rooms breakdown Rows
    if (proposal.rooms && proposal.rooms.length > 0) {
      proposal.rooms.forEach(room => {
        const roomRow = document.createElement('tr');
        
        let itemsListHTML = '<ul class="invoice-item-sub-list">';
        if (room.items && room.items.length > 0) {
          room.items.forEach(item => {
            itemsListHTML += `<li>${escapeHTML(item)}</li>`;
          });
        } else {
          itemsListHTML += '<li>No items recorded</li>';
        }
        itemsListHTML += '</ul>';

        roomRow.innerHTML = `
          <td>
            <strong style="color: var(--text-primary); text-transform: uppercase; font-size: 0.82rem;">${escapeHTML(room.name)}</strong>
            ${itemsListHTML}
          </td>
          <td style="text-align: center; color: var(--text-muted);">0</td>
          <td style="text-align: center; color: var(--text-muted);">-</td>
          <td style="text-align: right; color: var(--text-muted);">$0.00</td>
          <td style="text-align: right; color: var(--text-muted);">$0.00</td>
        `;
        itemsBody.appendChild(roomRow);
      });
    }

    // --- Inject Totals ---
    invSubtotal.innerText = formatCurrency(subtotalAmount);
    invTax.innerText = formatCurrency(taxAmount);
    invTotal.innerText = formatCurrency(totalAmount);

    // --- Render Payment Status ---
    if (proposal.payment && proposal.payment.status === 'Paid') {
      // Show paid stamp
      paidStamp.style.display = 'block';
      const pDate = new Date(proposal.payment.paidAt);
      paidStampDate.innerText = pDate.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Show receipt box
      paymentEftContainer.style.display = 'none';
      paymentOnlineContainer.style.display = 'none';
      paymentReceiptBox.style.display = 'block';
      
      receiptMethod.innerText = proposal.payment.method;
      receiptTxId.innerText = proposal.payment.transactionId;
      
      const receiptDateFormatted = pDate.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) + ' at ' + pDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      receiptDate.innerText = receiptDateFormatted;

      // Update Remainder Due
      invRemainder.innerText = '$0.00';
      invRemainder.style.color = '#2e7d32'; // settled green
    } else {
      // Hide paid stamp, show payment boxes
      paidStamp.style.display = 'none';
      paymentEftContainer.style.display = 'block';
      paymentOnlineContainer.style.display = 'block';
      paymentReceiptBox.style.display = 'none';

      invRemainder.innerText = formatCurrency(totalAmount);
      invRemainder.style.color = ''; // reset to default
    }

    // --- Inject Agreement Proof ---
    proofClientName.innerText = `${contract.firstName} ${contract.lastName}`;
    
    const timeFormatted = signedDate.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    proofSignedDate.innerText = `${signedDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${timeFormatted} (AEST)`;
    
    proofSigImg.src = contract.signature;

    // Show Content View
    loadingView.style.display = 'none';
    contentView.style.display = 'block';
  }

  // --- Xero Payment Simulation ---
  function initXeroCheckout() {
    if (!xeroPayBtn) return;

    // Open Modal or Redirect to Xero Gateway
    xeroPayBtn.addEventListener('click', async () => {
      if (!activeProposal) return;
      
      console.log('Checking Xero integration status...');
      let isXeroConnected = false;
      let onlineInvoiceUrl = null;
      
      // Show loading indicator on the payment button
      const originalBtnText = xeroPayBtn.innerHTML;
      xeroPayBtn.disabled = true;
      xeroPayBtn.innerHTML = '<span class="spinner" style="border-top-color: white; width: 14px; height: 14px; display: inline-block; margin-right: 8px; vertical-align: middle; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>Connecting to Xero...';

      // Inject temporary keyframes for button spinner if not already present
      if (!document.getElementById('spinner-keyframes')) {
        const style = document.createElement('style');
        style.id = 'spinner-keyframes';
        style.innerHTML = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }

      try {
        const statusRes = await fetch('http://localhost:5000/auth/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.connected) {
            isXeroConnected = true;
            console.log('Xero backend connected. Requesting real invoice creation...');
            xeroPayBtn.innerHTML = '<span class="spinner" style="border-top-color: white; width: 14px; height: 14px; display: inline-block; margin-right: 8px; vertical-align: middle; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>Generating Invoice...';
            
            // Call Xero invoice creation endpoint
            const invoiceRes = await fetch('http://localhost:5000/api/xero/invoice', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(activeProposal)
            });

            if (invoiceRes.ok) {
              const invoiceData = await invoiceRes.json();
              if (invoiceData.success && invoiceData.onlineInvoiceUrl) {
                onlineInvoiceUrl = invoiceData.onlineInvoiceUrl;
                console.log(`Successfully generated Xero invoice. Redirecting to: ${onlineInvoiceUrl}`);
                
                // Update Firebase with Xero invoice info
                await firebaseDb.ref('proposals/' + activeProposal.id + '/xeroInvoice').set({
                  invoiceId: invoiceData.invoiceId,
                  invoiceNumber: invoiceData.invoiceNumber,
                  onlineInvoiceUrl: invoiceData.onlineInvoiceUrl
                });
              } else {
                throw new Error('Invoice response did not contain success or onlineInvoiceUrl.');
              }
            } else {
              const errorData = await invoiceRes.json().catch(() => ({}));
              throw new Error(errorData.error || `Server returned status ${invoiceRes.status}`);
            }
          }
        }
      } catch (err) {
        console.warn('Xero API integration failed or server offline. Falling back to simulation mode.', err);
      } finally {
        // Restore button state
        xeroPayBtn.disabled = false;
        xeroPayBtn.innerHTML = originalBtnText;
      }

      if (isXeroConnected && onlineInvoiceUrl) {
        // Redirect client to real Xero secure payment gateway
        window.location.href = onlineInvoiceUrl;
      } else {
        // Fallback to high-fidelity mock credit card modal
        console.log('Opening mock credit card checkout modal (fallback/demo)...');
        
        // Populate fields in modal
        const shortId = activeProposal.id.substring(0, 5).toUpperCase();
        const dateStr = new Date(activeProposal.contract.signedAt).toLocaleDateString('en-AU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        xeroInvoiceNumText.innerText = `#SD-${shortId}/${dateStr.replace(/\//g, '')}`;
        xeroClientNameText.innerText = `${activeProposal.approval.firstName} ${activeProposal.approval.lastName}`;
        
        const totalAmount = parseFloat(activeProposal.price.replace(/,/g, '')) || 0;
        xeroAmountDueText.innerText = formatCurrency(totalAmount);
        
        // Reset modal screens
        xeroPaymentForm.reset();
        xeroLoader.style.display = 'none';
        xeroSuccess.style.display = 'none';
        cardBrandIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
        cardBrandIcon.className = 'card-brand-indicator';
        
        xeroModal.classList.add('active');
      }
    });

    // Close Modal
    const closeModal = () => {
      xeroModal.classList.remove('active');
    };
    xeroModalClose.addEventListener('click', closeModal);
    xeroBtnCancel.addEventListener('click', closeModal);

    // Format Card Number (adds space every 4 digits)
    xeroCardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      
      // Detect card brand
      if (value.startsWith('4')) {
        // Visa
        cardBrandIcon.innerHTML = `<strong>Visa</strong>`;
        cardBrandIcon.className = 'card-brand-indicator active';
      } else if (value.startsWith('51') || value.startsWith('52') || value.startsWith('53') || value.startsWith('54') || value.startsWith('55')) {
        // Mastercard
        cardBrandIcon.innerHTML = `<strong>MC</strong>`;
        cardBrandIcon.className = 'card-brand-indicator active';
      } else if (value.startsWith('34') || value.startsWith('37')) {
        // AMEX
        cardBrandIcon.innerHTML = `<strong>Amex</strong>`;
        cardBrandIcon.className = 'card-brand-indicator active';
      } else {
        cardBrandIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
        cardBrandIcon.className = 'card-brand-indicator';
      }

      let formatted = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formatted += ' ';
        }
        formatted += value[i];
      }
      e.target.value = formatted;
    });

    // Format Expiry Date (adds MM / YY slash)
    xeroCardExpiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 2) {
        e.target.value = value.substring(0, 2) + ' / ' + value.substring(2, 4);
      } else {
        e.target.value = value;
      }
    });

    // CVV - digits only
    xeroCardCvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });

    // Submit Payment Form
    xeroPaymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const cardNum = xeroCardNumberInput.value.replace(/\s/g, '');
      const expiry = xeroCardExpiryInput.value;
      const cvv = xeroCardCvvInput.value;
      
      if (cardNum.length < 13) {
        alert('Please enter a valid card number.');
        return;
      }
      if (!expiry.includes('/')) {
        alert('Please enter a valid expiry date (MM / YY).');
        return;
      }
      if (cvv.length < 3) {
        alert('Please enter a valid CVV.');
        return;
      }

      // Show secure loader with message sequencing
      xeroLoader.style.display = 'flex';
      
      const states = [
        { time: 0, text: 'Connecting to secure Xero gateway...' },
        { time: 800, text: 'Verifying card credentials...' },
        { time: 1600, text: 'Authorising payment with bank...' },
        { time: 2400, text: 'Finalising transaction...' }
      ];
      
      states.forEach(state => {
        setTimeout(() => {
          xeroLoaderStatus.innerText = state.text;
        }, state.time);
      });

      // Complete payment after 3.2 seconds
      setTimeout(async () => {
        try {
          const paymentData = {
            status: 'Paid',
            method: 'Credit Card',
            transactionId: 'XERO-TXN-' + Math.floor(10000000 + Math.random() * 90000000),
            paidAt: new Date().toISOString(),
            cardHolder: xeroCardNameInput.value.trim()
          };

          // Save payment details directly to Firebase Realtime Database
          await firebaseDb.ref('proposals/' + activeProposal.id + '/payment').set(paymentData);
          
          // Update local active proposal reference
          activeProposal = {
            ...activeProposal,
            payment: paymentData
          };
          
          xeroLoader.style.display = 'none';
          xeroSuccess.style.display = 'flex';
        } catch (err) {
          console.error('Failed to save payment status:', err);
          alert('An error occurred while saving the payment to Firebase. Please try again: ' + err.message);
          xeroLoader.style.display = 'none';
        }
      }, 3200);
    });

    // Success Screen Return Button
    xeroBtnDone.addEventListener('click', () => {
      closeModal();
      renderInvoice(activeProposal);
    });
  }

  // Initialize checkout events
  initXeroCheckout();

  // --- Helpers ---
  function formatCurrency(val) {
    return '$' + parseFloat(val).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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
});

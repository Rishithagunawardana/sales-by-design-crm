document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loadingView = document.getElementById('proposal-loading');
  const errorView = document.getElementById('proposal-error');
  const contentView = document.getElementById('proposal-content');
  
  const displayTitleCover = document.getElementById('prop-display-title-cover');
  const displaySubtitle = document.getElementById('prop-display-subtitle');
  const displayDate = document.getElementById('prop-display-date');
  const displayPrice = document.getElementById('prop-display-price');
  const displayTax = document.getElementById('prop-display-tax');
  const inclusionsContainer = document.getElementById('prop-display-inclusions');
  const roomsContainer = document.getElementById('prop-display-rooms');
  
  // Approval elements
  const clientApprovalForm = document.getElementById('client-approval-form');
  const proposalApprovalSection = document.getElementById('proposal-approval-section');
  const approvedBannerSection = document.getElementById('approved-banner-section');
  const approvedByName = document.getElementById('approved-by-name');
  const approvedOnDate = document.getElementById('approved-on-date');
  
  const submitApprovalBtn = document.getElementById('submit-approval-btn');
  const acceptBtnText = document.getElementById('accept-btn-text');
  const acceptBtnSpinner = document.getElementById('accept-btn-spinner');
  
  const acceptanceModal = document.getElementById('acceptance-modal');
  const closeAcceptanceBtn = document.getElementById('close-acceptance-btn');

  // Extract ID from query parameter: ?id=6a30e10dd1d243ea36e31e21 or pathname
  const urlParams = new URLSearchParams(window.location.search);
  let proposalId = urlParams.get('id');
  if (!proposalId) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      proposalId = pathParts[pathParts.length - 1];
    }
  }

  if (!proposalId) {
    showError();
  } else {
    fetchProposalDetails(proposalId);
  }

  // Event listeners
  closeAcceptanceBtn.addEventListener('click', () => {
    acceptanceModal.style.display = 'none';
    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocalFile ? `contract.html?id=${proposalId}` : `/proposal/${proposalId}/contract`;
  });

  if (clientApprovalForm) {
    clientApprovalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const firstName = document.getElementById('client-first-name').value.trim();
      const lastName = document.getElementById('client-last-name').value.trim();
      const email = document.getElementById('client-email').value.trim();
      const phone = document.getElementById('client-phone').value.trim();
      const addressLine1 = document.getElementById('client-address-1').value.trim();
      const addressLine2 = document.getElementById('client-address-2').value.trim();
      const city = document.getElementById('client-city').value.trim();
      const state = document.getElementById('client-state').value.trim();
      const postcode = document.getElementById('client-postcode').value.trim();
 
      setSubmitting(true);
 
      try {
        const approval = {
          firstName,
          lastName,
          email,
          phone,
          addressLine1,
          addressLine2: addressLine2 || '',
          city,
          state,
          postcode,
          approvedAt: new Date().toISOString()
        };
 
        // Save directly to Firebase Realtime Database
        await firebaseDb.ref('proposals/' + proposalId + '/approval').set(approval);
        
        // Show pop-up acceptance modal first, then redirect on close
        acceptanceModal.style.display = 'flex';
      } catch (err) {
        console.error('Failed to submit approval:', err);
        alert('A database error occurred. Please try again: ' + err.message);
      } finally {
        setSubmitting(false);
      }
    });
  }
 
  // --- API Fetching ---
  async function fetchProposalDetails(id) {
    try {
      // Read from Firebase Realtime Database
      const snapshot = await firebaseDb.ref('proposals/' + id).once('value');
      let proposal = snapshot.val();
      
      if (!proposal) {
        console.log(`Proposal ${id} not found in Firebase. Checking server data fallback...`);
        const response = await fetch('/data/proposals.json');
        if (response.ok) {
          const serverProposals = await response.json();
          proposal = serverProposals.find(p => p.id === id);
          if (proposal) {
            // Seed this specific proposal into Firebase Database
            await firebaseDb.ref('proposals/' + id).set(proposal);
            console.log(`Imported proposal ${id} from server data into Firebase Database.`);
          }
        }
      }
 
      if (!proposal) {
        showError();
        return;
      }
      renderProposal(proposal);
    } catch (err) {
      console.error('Error fetching proposal details:', err);
      showError();
    }
  }

  function showError() {
    loadingView.style.display = 'none';
    errorView.style.display = 'block';
  }

  function renderProposal(proposal) {
    // Page browser title
    document.title = `${proposal.title} | Sale by Design Homes`;

    // Dynamic Navigation links
    const isLocalFile = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    document.getElementById('nav-contract-link').href = isLocalFile ? `contract.html?id=${proposal.id}` : `/proposal/${proposal.id}/contract`;
    document.getElementById('nav-invoice-link').href = isLocalFile ? `invoice.html?id=${proposal.id}` : `/proposal/${proposal.id}/invoice`;

    // Cover page & card headers
    displayTitleCover.innerText = proposal.title;
    displaySubtitle.innerText = proposal.subtitle || 'Property Styling Package';
    
    // Formatting date helper
    const dateObj = new Date(proposal.createdAt);
    const formattedDate = dateObj.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    displayDate.innerText = `Proposal Date: ${formattedDate}`;

    // Price Details
    displayPrice.innerText = `$${proposal.price}`;
    displayTax.innerText = proposal.taxLabel || 'incl. GST';

    // Service Inclusions
    if (proposal.inclusions && proposal.inclusions.length > 0) {
      inclusionsContainer.innerHTML = '';
      proposal.inclusions.forEach(inclusion => {
        const li = document.createElement('li');
        li.innerText = inclusion;
        inclusionsContainer.appendChild(li);
      });
      document.getElementById('prop-display-inclusions-section').style.display = 'block';
    } else {
      document.getElementById('prop-display-inclusions-section').style.display = 'none';
    }

    // Room Breakdown (Single-Card Style)
    roomsContainer.innerHTML = '';
    if (proposal.rooms && proposal.rooms.length > 0) {
      proposal.rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'package-room-item';
        
        let itemsHTML = '<ul class="package-room-items-bullet">';
        if (room.items && room.items.length > 0) {
          room.items.forEach(itm => {
            itemsHTML += `<li>${escapeHTML(itm)}</li>`;
          });
        } else {
          itemsHTML += '<li style="color: var(--text-muted); font-style: italic; list-style: none; padding-left: 0;">No specific items listed</li>';
        }
        itemsHTML += '</ul>';
        
        roomDiv.innerHTML = `
          <h5 class="package-room-name">${escapeHTML(room.name)}</h5>
          ${itemsHTML}
        `;
        roomsContainer.appendChild(roomDiv);
      });
    } else {
      roomsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 40px; border: 1px dashed var(--border-color); background: white;">
          No room styling packages listed in this proposal.
        </div>
      `;
    }

    // Toggle Approval Form vs Approved Banner
    if (proposal.approval) {
      proposalApprovalSection.style.display = 'none';
      
      const approvalDateObj = new Date(proposal.approval.approvedAt);
      const formattedApprovalDate = approvalDateObj.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      approvedByName.innerText = `${proposal.approval.firstName} ${proposal.approval.lastName}`;
      approvedOnDate.innerText = formattedApprovalDate;

      // Injected signed agreement / invoice links
      const actionContainer = document.getElementById('approved-action-container');
      
      let contractActionText = 'Proceed to Styling Agreement';
      if (proposal.contract) {
        contractActionText = 'View Signed Styling Agreement';
      }
      
      const contractUrl = isLocalFile ? `contract.html?id=${proposalId}` : `/proposal/${proposalId}/contract`;
      const invoiceUrl = isLocalFile ? `invoice.html?id=${proposalId}` : `/proposal/${proposalId}/invoice`;
      
      actionContainer.innerHTML = `
        <a href="${contractUrl}" class="btn-submit-proposal" style="display: block; text-align: center; text-decoration: none; margin-top: 10px;">
          ${contractActionText}
        </a>
        ${proposal.contract ? `
        <a href="${invoiceUrl}" class="btn-submit-proposal" style="display: block; text-align: center; text-decoration: none; background-color: var(--accent-gold-dark); margin-top: 10px;">
          View Tax Invoice
        </a>` : ''}
      `;
      
      approvedBannerSection.style.display = 'flex';
    } else {
      approvedBannerSection.style.display = 'none';
      proposalApprovalSection.style.display = 'block';
    }

    // Transition view
    loadingView.style.display = 'none';
    contentView.style.display = 'block';
  }

  function setSubmitting(isSubmitting) {
    if (isSubmitting) {
      submitApprovalBtn.disabled = true;
      acceptBtnText.style.display = 'none';
      acceptBtnSpinner.style.display = 'inline-block';
    } else {
      submitApprovalBtn.disabled = false;
      acceptBtnText.style.display = 'inline';
      acceptBtnSpinner.style.display = 'none';
    }
  }

  // --- FAQ Accordion Toggle Interaction ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all open items
      faqItems.forEach(i => {
        i.classList.remove('active');
        i.querySelector('.faq-content').style.display = 'none';
        i.querySelector('.faq-icon').innerHTML = '&plus;';
      });
      
      // Toggle current active state
      if (!isActive) {
        item.classList.add('active');
        item.querySelector('.faq-content').style.display = 'block';
        item.querySelector('.faq-icon').innerHTML = '&minus;';
      }
    });
  });

  // --- Testimonials Slider Interaction ---
  let currentSlide = 0;
  const slides = [
    {
      quote: `"Sale by Design staged our house for sale and we were thrilled with the result. Professional, well-planned styling with furniture and accessories that perfectly complemented our home. Highly recommend"`,
      author: "— Rosanna Velevski"
    },
    {
      quote: `"Working with Sale by Design Homes made our campaign incredibly easy. The team understood the target buyer profile and styled the home to feel spacious and premium. We sold within 2 weeks!"`,
      author: "— Marcus Chen, Vendor"
    },
    {
      quote: `"As developers, staging is critical for our off-the-plan campaigns. Sale by Design Homes consistently delivers high-quality furniture, professional styling, and fast setup times."`,
      author: "— Sarah Jenkins, Developer"
    }
  ];

  const testimonialQuote = document.querySelector('.testimonial-quote');
  const testimonialAuthor = document.querySelector('.testimonial-author');
  const prevBtn = document.querySelector('.slider-nav-btn.prev');
  const nextBtn = document.querySelector('.slider-nav-btn.next');

  function updateTestimonial(index) {
    if (!testimonialQuote || !testimonialAuthor) return;
    // Simple fade transition by changing opacity classes
    testimonialQuote.style.opacity = '0';
    testimonialAuthor.style.opacity = '0';
    testimonialQuote.style.transition = 'opacity 0.2s ease';
    testimonialAuthor.style.transition = 'opacity 0.2s ease';
    
    setTimeout(() => {
      testimonialQuote.innerText = slides[index].quote;
      testimonialAuthor.innerText = slides[index].author;
      testimonialQuote.style.opacity = '1';
      testimonialAuthor.style.opacity = '1';
    }, 200);
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentSlide = (currentSlide === 0) ? slides.length - 1 : currentSlide - 1;
      updateTestimonial(currentSlide);
    });
    nextBtn.addEventListener('click', () => {
      currentSlide = (currentSlide === slides.length - 1) ? 0 : currentSlide + 1;
      updateTestimonial(currentSlide);
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

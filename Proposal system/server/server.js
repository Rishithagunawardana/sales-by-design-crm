require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');

// Dynamic Xero SDK Loading
let XeroClient;
let xero;
let xeroAvailable = false;

try {
  const xeroNode = require('@xero/xero-node');
  XeroClient = xeroNode.XeroClient;
  xeroAvailable = true;
  console.log('Xero SDK loaded successfully.');
} catch (e) {
  try {
    const xeroNode = require('xero-node');
    XeroClient = xeroNode.XeroClient;
    xeroAvailable = true;
    console.log('Xero SDK loaded successfully (fallback package).');
  } catch (err) {
    console.warn('Xero SDK (xero-node) could not be loaded. Xero integration is disabled, but SMTP email service remains active.');
  }
}

const app = express();

// Initialize SMTP Transporter for Email Service
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  tls: {
    // Bypass self-signed certificate check in local dev / network proxies
    rejectUnauthorized: false
  }
});

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend portal (supports both localhost and 127.0.0.1 dynamically)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    const isLocal = origin.startsWith('http://localhost:') || 
                    origin.startsWith('http://127.0.0.1:') || 
                    origin === frontendUrl;
                    
    if (isLocal) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Session configuration for secure token storage
app.use(session({
  secret: process.env.SESSION_SECRET || 'xero_default_session_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running behind HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Xero SDK Client if available
const scopes = [
  'openid',
  'profile',
  'email',
  'accounting.transactions',
  'accounting.contacts',
  'offline_access' // Required to receive refresh tokens
];

if (xeroAvailable && XeroClient) {
  try {
    xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET,
      redirectUris: [process.env.XERO_REDIRECT_URI],
      scopes: scopes
    });
  } catch (err) {
    console.error('Failed to initialize Xero client:', err.message);
    xeroAvailable = false;
  }
}

// Middleware to ensure Xero connectivity and handle automatic token refresh
async function checkXeroToken(req, res, next) {
  if (!xeroAvailable) {
    return res.status(503).json({ 
      error: 'Xero integration is currently disabled because the Xero SDK is not installed.' 
    });
  }
  if (!req.session.tokenSet || !req.session.activeTenantId) {
    return res.status(401).json({ 
      error: 'Not connected to Xero. Please authenticate at /auth/connect' 
    });
  }
  
  const tokenSet = req.session.tokenSet;
  xero.setTokenSet(tokenSet);
  
  // Check token expiration
  const expired = new Date() > new Date(tokenSet.expires_at * 1000);
  if (expired) {
    try {
      console.log('Xero access token expired. Refreshing token...');
      const refreshedTokenSet = await xero.refreshToken();
      req.session.tokenSet = refreshedTokenSet;
      xero.setTokenSet(refreshedTokenSet);
      console.log('Xero access token refreshed successfully.');
    } catch (err) {
      console.error('Failed to refresh Xero token:', err);
      // Clear session so the user must authenticate again
      req.session.destroy();
      return res.status(401).json({ 
        error: 'Xero session expired. Please re-authenticate at /auth/connect' 
      });
    }
  }
  next();
}

/* =========================================================================
   OAuth 2.0 Routes
   ========================================================================= */

// 1. Connect Route: Redirects to Xero's consent page
app.get('/auth/connect', async (req, res) => {
  if (!xeroAvailable) {
    return res.status(503).send('Xero integration is disabled because the Xero SDK is not installed.');
  }
  try {
    const consentUrl = await xero.buildConsentUrl();
    res.redirect(consentUrl);
  } catch (err) {
    console.error('Error building consent URL:', err);
    res.status(500).send('Error starting Xero authentication flow.');
  }
});

// 2. Callback Route: Exchanges authorization code for access token
app.get('/auth/callback', async (req, res) => {
  if (!xeroAvailable) {
    return res.status(503).send('Xero integration is disabled because the Xero SDK is not installed.');
  }
  try {
    const tokenSet = await xero.apiCallback(req.url);
    req.session.tokenSet = tokenSet;
    
    // Retrieve and set the active Tenant (organization) ID
    await xero.updateTenants();
    if (xero.tenants.length === 0) {
      return res.status(400).send('No authorized Xero organizations found.');
    }
    
    // Default to the first authorized organization tenant
    const activeTenant = xero.tenants[0];
    req.session.activeTenantId = activeTenant.id;
    req.session.tenantName = activeTenant.tenantName;
    
    console.log(`Connected to Xero organization: ${activeTenant.tenantName} (${activeTenant.id})`);
    
    // Redirect back to frontend dashboard
    res.redirect(`${frontendUrl}/dashboard.html?connected=true`);
  } catch (err) {
    console.error('Error in Xero OAuth callback:', err);
    res.status(500).send('Xero authentication failed.');
  }
});

// 3. Status Route: Returns connection state to the frontend
app.get('/auth/status', (req, res) => {
  if (!xeroAvailable) {
    return res.json({ connected: false, disabled: true });
  }
  if (req.session.tokenSet && req.session.activeTenantId) {
    res.json({
      connected: true,
      tenantName: req.session.tenantName
    });
  } else {
    res.json({ connected: false });
  }
});

// 4. Disconnect Route: Clear Xero session data
app.get('/auth/disconnect', (req, res) => {
  if (!xeroAvailable) {
    return res.json({ success: true, message: 'Xero SDK not installed, session is already disconnected.' });
  }
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy failed:', err);
      return res.status(500).json({ error: 'Failed to disconnect session.' });
    }
    res.json({ success: true, message: 'Disconnected from Xero.' });
  });
});

/* =========================================================================
   Xero API Operations
   ========================================================================= */

// Create Xero Invoice and Retrieve Online Gateway URL
app.post('/api/xero/invoice', checkXeroToken, async (req, res) => {
  const proposal = req.body;
  const tenantId = req.session.activeTenantId;
  
  if (!proposal || !proposal.id || !proposal.price) {
    return res.status(400).json({ error: 'Invalid proposal payload.' });
  }
  
  try {
    let contactId = null;
    const email = proposal.clientEmail;
    
    // 1. Search for existing contact in Xero by email
    const getContactsResponse = await xero.accountingApi.getContacts(tenantId, null, `EmailAddress=="${email}"`);
    const contacts = getContactsResponse.body.contacts;
    
    if (contacts && contacts.length > 0) {
      contactId = contacts[0].contactID;
      console.log(`Matching Contact found: ${contacts[0].name} (${contactId})`);
    } else {
      // Split client name to first and last name safely
      const nameParts = proposal.clientName ? proposal.clientName.trim().split(/\s+/) : ['Client'];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Staging';
      
      const newContact = {
        name: proposal.clientName || 'Unnamed Client',
        firstName,
        lastName,
        emailAddress: email,
        phones: proposal.clientPhone ? [{ phoneType: 'DEFAULT', phoneNumber: proposal.clientPhone }] : [],
        addresses: [
          {
            addressType: 'POBOX', // Billing
            addressLine1: proposal.billingAddress?.line1 || '',
            city: proposal.billingAddress?.city || '',
            region: proposal.billingAddress?.state || '',
            postalCode: proposal.billingAddress?.postcode || '',
            country: 'Australia'
          }
        ]
      };
      
      // Create new contact
      const createContactResponse = await xero.accountingApi.createContacts(tenantId, { contacts: [newContact] });
      contactId = createContactResponse.body.contacts[0].contactID;
      console.log(`New Contact created: ${proposal.clientName} (${contactId})`);
    }
    
    // 2. Build Invoice Details
    const price = parseFloat(proposal.price.replace(/,/g, '')) || 0;
    const hasGST = proposal.taxLabel && proposal.taxLabel.toLowerCase().includes('gst');
    
    // Set amounts to Tax Inclusive/Exclusive
    const lineAmountType = hasGST ? 'Inclusive' : 'Exclusive';
    
    let lineDescription = `${proposal.title}\n`;
    if (proposal.inclusions && proposal.inclusions.length > 0) {
      lineDescription += `\nService Inclusions:\n` + proposal.inclusions.map(inc => `• ${inc}`).join('\n');
    }
    
    const lineItems = [
      {
        description: lineDescription,
        quantity: 1.0,
        unitAmount: price,
        accountCode: '200', // Default Sales account code in Xero demo charts
        taxType: hasGST ? 'OUTPUT' : 'NONE' // OUTPUT is standard 10% sales tax in AU Xero orgs
      }
    ];
    
    // Unique Invoice Reference Number
    const shortId = proposal.id.substring(0, 5).toUpperCase();
    const invoiceNumber = `SD-${shortId}-${Date.now().toString().slice(-6)}`;
    
    const newInvoice = {
      type: 'ACCREC', // Receivable sales invoice
      contact: { contactID: contactId },
      lineItems: lineItems,
      invoiceNumber: invoiceNumber,
      reference: `Proposal #${proposal.id}`,
      lineAmountTypes: lineAmountType,
      date: new Date().toISOString().split('T')[0], // Today's Date
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0], // 48 Hours Term
      status: 'AUTHORISED' // Pre-approve invoice to make it instantly ready for payment gateway redirects
    };
    
    // 3. Create invoice
    const createInvoiceResponse = await xero.accountingApi.createInvoices(tenantId, { invoices: [newInvoice] });
    const createdInvoice = createInvoiceResponse.body.invoices[0];
    const invoiceId = createdInvoice.invoiceID;
    
    console.log(`Xero Invoice generated successfully: ${invoiceNumber} (${invoiceId})`);
    
    // 4. Retrieve Online Payment Gateway URL from Xero
    const getOnlineUrlResponse = await xero.accountingApi.getOnlineInvoice(tenantId, invoiceId);
    const onlineInvoiceUrl = getOnlineUrlResponse.body.onlineInvoices[0].onlineInvoiceUrl;
    
    console.log(`Retrieved Xero payment URL: ${onlineInvoiceUrl}`);
    
    res.json({
      success: true,
      invoiceId: invoiceId,
      invoiceNumber: createdInvoice.invoiceNumber,
      amountDue: createdInvoice.amountDue,
      onlineInvoiceUrl: onlineInvoiceUrl
    });
    
  } catch (err) {
    console.error('Xero Invoice generation failed:', err);
    
    // Extract validation feedback from Xero payload
    const xeroErrors = err.response && err.response.body && err.response.body.Elements
      ? err.response.body.Elements.flatMap(el => el.ValidationErrors || []).map(ve => ve.Message)
      : [];
      
    res.status(500).json({
      error: 'Failed to create invoice in Xero.',
      details: err.message,
      validationErrors: xeroErrors
    });
  }
});

/* =========================================================================
   Email Service Routes
   ========================================================================= */

// API Endpoint to Send Proposal Email via SMTP
app.post('/api/email/send-proposal', async (req, res) => {
  const { proposalId, clientEmail, clientName, proposalTitle, price } = req.body;

  if (!proposalId || !clientEmail || !clientName || !proposalTitle) {
    return res.status(400).json({ error: 'Missing required email parameters.' });
  }

  // Check if SMTP credentials are set
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP Credentials are not configured in .env. Email logging to console instead.');
    const proposalUrl = `${frontendUrl}/proposal.html?id=${proposalId}`;
    console.log(`\n--- Simulated Email Send ---`);
    console.log(`To: ${clientEmail}`);
    console.log(`Subject: Your Custom Property Staging Proposal: ${proposalTitle}`);
    console.log(`Body:\nDear ${clientName},\n\nWe are delighted to present your tailored property styling proposal for ${proposalTitle}.\n\nWith 16 years in the market and more than 6,000 properties beautifully styled, our team knows exactly how to capture buyers' attention. In fact, our strategic styling added over $42,000,000 in market value to our clients' properties last year alone—and we look forward to helping your property stand out to potential buyers.\n\nPlease click the link below to review your interactive, digital proposal and explore your customized room-by-room design concept:\n\n[VIEW STYLING PROPOSAL]: ${proposalUrl}\n\nNext Steps to Secure Your Date:\nTo move forward and secure your spot, simply click the link above to input your details and sign the digital agreement. Due to high demand, we highly recommend completing the proposal soon to secure your preferred installation date.\n\nIf you have any questions at all, please don't hesitate to reach out. We are so excited to work together to showcase your property's full potential!\n\nWarm regards,\n\n[IMAGE SIGNATURE: signature.jpg]`);
    console.log(`-----------------------------\n`);
    return res.json({ 
      success: true, 
      simulated: true, 
      message: 'SMTP not configured in .env. Email logged to server console.' 
    });
  }

  const proposalUrl = `${frontendUrl}/proposal.html?id=${proposalId}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Sale by Design Homes" <proposals@salebydesignhomes.com.au>',
    to: clientEmail,
    subject: `Your Custom Property Staging Proposal: ${proposalTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @media only screen and (max-width: 520px) {
            .email-container {
              padding: 20px 10px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff;">
        <div class="email-container" style="font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 10px auto; padding: 30px 20px; background-color: #ffffff; color: #333333; box-sizing: border-box; width: 95%;">
          <!-- Header (Pure HTML/CSS Logo to avoid SVG email client issues) -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #e8e6e1; padding-bottom: 20px; font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; user-select: none;">
            <div style="font-size: 12px; font-weight: 500; color: #1c1c1c; letter-spacing: 0.35em; text-transform: uppercase; margin-bottom: 3px; line-height: 1.2; padding-left: 0.35em;">SALE BY DESIGN</div>
            <div style="font-size: 44px; font-weight: 900; color: #1c1c1c; letter-spacing: -0.03em; text-transform: uppercase; line-height: 0.9;">HOMES</div>
          </div>

          <!-- Body -->
          <div style="font-size: 14px; line-height: 1.6; color: #444444;">
            <p style="margin-top: 0; margin-bottom: 16px;">Dear <strong>${clientName}</strong>,</p>
            
            <p style="margin-bottom: 16px;">We are delighted to present your tailored property styling proposal for <strong>${proposalTitle}</strong>.</p>
            
            <p style="margin-bottom: 16px;">With 16 years in the market and more than 6,000 properties beautifully styled, our team knows exactly how to capture buyers' attention. In fact, our strategic styling added over $42,000,000 in market value to our clients' properties last year alone—and we look forward to helping your property stand out to potential buyers.</p>
            
            <p style="margin-bottom: 16px;">Please click the link below to review your interactive, digital proposal and explore your customized room-by-room design concept:</p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${proposalUrl}" target="_blank" style="background-color: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: 600; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 3px; display: inline-block;">View Staging Proposal</a>
            </div>

            <!-- Highlight Box for Next Steps -->
            <div style="background-color: #f6f5f1; border-left: 3px solid #ad8f65; padding: 15px 20px; margin: 25px 0; border-radius: 0 4px 4px 0;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a432b; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase;">Next Steps to Secure Your Date:</p>
              <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: #555555;">To move forward and secure your spot, simply click the link above to input your details and sign the digital agreement. Due to high demand, we highly recommend completing the proposal soon to secure your preferred installation date.</p>
            </div>

            <p style="margin-bottom: 20px;">If you have any questions at all, please don't hesitate to reach out. We are so excited to work together to showcase your property's full potential!</p>
            
            <p style="margin-bottom: 15px;">Warm regards,</p>
            
            <!-- Elegant Signature Block -->
            <div style="margin-top: 20px;">
              <img src="cid:email_signature" alt="Deshan Wijeratne - Operations Manager - Sale by Design Homes" style="width: 100%; max-width: 500px; height: auto; display: block; border: 0;">
            </div>
          </div>

          <!-- Muted Footer Note -->
          <div style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e8e6e1; font-size: 9px; text-align: center; color: #aaaaaa; font-style: italic;">
            This is an automated proposal notification. Please do not reply directly to this email.
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'signature.jpg',
        path: path.join(__dirname, '../images/signature.jpg'),
        cid: 'email_signature'
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Proposal email sent via SMTP successfully to ${clientEmail}: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('SMTP email sending failed:', err);
    res.status(500).json({ error: 'Failed to send email via SMTP.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Xero & SMTP Integration Backend Server running on port ${PORT}`);
  console.log(`Local authentication URL: http://localhost:${PORT}/auth/connect`);
  console.log(`===================================================`);
});
